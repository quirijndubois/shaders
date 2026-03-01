#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform vec2 u_camera;
uniform float u_zoom;

struct SDF {
	float distance;
	vec3 position;
	bool hit;
	vec3 color;
	float roughness;
};

// Float-based hash to generate a float in [0,1)
float rand(in vec2 co) {
    highp float a = 12.9898;
    highp float b = 78.233;
    highp float c = 43758.5453;
    highp float dt = dot(co, vec2(a, b));
    highp float sn = mod(dt, 3.14159265);
    return fract(sin(sn) * c);
}

// 2D random vector
vec2 rand2(in vec2 co) {
    return vec2(rand(co), rand(co + vec2(5.23, 1.37)));
}


// Cosine-weighted hemisphere sampling
vec3 randomHemisphereDirection(vec3 normal, vec2 seed) {
    vec2 u = rand2(seed);
    float u1 = u.x;
    float u2 = u.y;

    // Cosine-weighted polar coordinates
    float r = sqrt(u1);
    float theta = 2.0 * 3.14159265 * u2;

    float x = r * cos(theta);
    float y = r * sin(theta);
    float z = sqrt(1.0 - u1);

    // Create tangent space basis
    vec3 tangent = normalize(abs(normal.x) > 0.1 ? cross(normal, vec3(0,1,0)) : cross(normal, vec3(1,0,0)));
    vec3 bitangent = cross(normal, tangent);

    // Transform from tangent space to world space
    return normalize(x * tangent + y * bitangent + z * normal);
}

float sdf_circle(vec3 p, float r) {
	return length(p) - r;
}

float sdf_floor(vec3 p) {
	return p.y;
}

float sdf_box(vec3 p, vec3 b) {
	vec3 d = abs(p) - b;
	return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

float smooth_union(float d1, float d2, float k) {
	float h = max(k - abs(d1 - d2), 0.0) / k;
	return min(d1, d2) - h * h * k * 0.25;
}

SDF scene_sdf(vec3 p) {
	float d1 = sdf_circle(p - vec3(0.5, 0.25, 0.5), 0.25);
	float d2 = sdf_circle(p - vec3(-0.5, 0.5, -0.5), 0.5);
	float d3 = sdf_box(p - vec3(0.3, 0.0, 0.0), vec3(0.4, 0.3, 0.2));
	float d4 = sdf_floor(p);

	float d = min(d1, d2);
	d = min(d, d3);
	d = min(d, d4);
	SDF result;
	result.distance = d;
	result.position = p;
	result.color = vec3(1.0);
	if (d3 < d1 && d3 < d2 && d3 < d4) {
		result.roughness = 0.4;
	}
	else if (d2 < d1 && d2 < d3 && d2 < d4) {
		result.roughness = 0.8;
		result.color = vec3(0.8, 0.2, 0.2); // Red for second circle
	}
	else if (d1 < d2 && d1 < d3 && d1 < d4) {
		result.roughness = 1.0;
		result.color = vec3(0.2, 0.2, 0.8); // Blue for first circle
	}
	else {
		result.roughness = 0.9;
	}
	return result;
}

// SDF scene_sdf(vec3 p) {
// 	float circle_d = sdf_circle(p - vec3(0.0, 0.25, 0.0), 0.25);
// 	float floor_d = sdf_floor(p);
// 	float d = min(circle_d, floor_d);
//
// 	SDF result;
// 	result.distance = d;
// 	result.position = p;
// 	if (floor_d > circle_d){
// 		result.color = vec3(1.0, 0.0, 0.0);
// 		result.roughness = 0.9;
// 	}
// 	else {
// 		result.color = vec3(1.0);
// 		result.roughness = 0.9;
// 	}
//
//
// 	return result;
// }



vec3 normal(vec3 p) {
	const float h = 0.001;
	vec3 n;
	n.x = scene_sdf(p + vec3(h, 0.0, 0.0)).distance - scene_sdf(p - vec3(h, 0.0, 0.0)).distance;
	n.y = scene_sdf(p + vec3(0.0, h, 0.0)).distance - scene_sdf(p - vec3(0.0, h, 0.0)).distance;
	n.z = scene_sdf(p + vec3(0.0, 0.0, h)).distance - scene_sdf(p - vec3(0.0, 0.0, h)).distance;
	return normalize(n);
}

SDF ray_march(vec3 ro, vec3 rd) {
	float t = 0.0;
	const float max_distance = 100.0;
	const float epsilon = 0.001;
	SDF sdf_result;
	for (int i = 0; i < 100; i++) {
		vec3 p = ro + rd * t;
		SDF sdf_result = scene_sdf(p);
		float d = sdf_result.distance;
		if (d < epsilon) {
			sdf_result.hit = true;
			return sdf_result;
			}
		t += d;
		if (t > max_distance){
			sdf_result.hit = false;
		break;
		}
	}
	sdf_result.hit = false;
	return sdf_result;
}

vec3 get_lighting(SDF sdf, vec3 sun_dir) {
	vec3 p = sdf.position;
	vec3 n = normal(p);
	SDF sun_path = ray_march(p + n * 0.01, sun_dir);
	if (sun_path.hit) return vec3(0.0);

	float light = max(dot(n, sun_dir), 0.0);
	return light * sdf.color;
}

vec3 reflect_dir(vec3 I, vec3 N) {
	return I - 2.0 * dot(N, I) * N;
}

vec3 perform_ray_march(vec3 ro, vec3 rd, vec3 sun_dir) {
	SDF first_march = ray_march(ro, rd);
	vec3 p = first_march.position;
	if (first_march.hit == false) return vec3(0.0);

	// Calculate reflections
	vec3 reflective_lighting = vec3(0.0);
	vec3 n = normal(p);
	vec3 reflected_dir = reflect_dir(rd, n);
	SDF reflected_march = ray_march(p + n * 0.01, reflected_dir);
	if (reflected_march.hit) {
		reflective_lighting = get_lighting(reflected_march, sun_dir);
	}

	// calculte indirect lighting
	vec3 indirect_lighting = vec3(0.0);
	const int ITERATIONS = 50;
	for (int i = 0; i < ITERATIONS; i++) {
		vec2 seed = gl_FragCoord.xy + vec2(float(i)*13.37, float(u_time)*17.29);
		vec3 indirect_dir = randomHemisphereDirection(n, seed);
		SDF indirect_lighting_march = ray_march(p + n * 0.01, indirect_dir);
		if (indirect_lighting_march.hit) {
			indirect_lighting += get_lighting(indirect_lighting_march, sun_dir) * first_march.color / float(ITERATIONS);
		}
	}

	// calculate direct lighting
	vec3 direct_lighting = get_lighting(first_march, sun_dir);


	reflective_lighting *= (1.0 - first_march.roughness);
	direct_lighting *= first_march.roughness;


	vec3 color = vec3(0.0);
	color += indirect_lighting;
	color += direct_lighting;
	color += reflective_lighting;
	return color;
}

vec3 ray_direction(vec2 uv, vec3 camera_direction) {
	vec3 forward = normalize(camera_direction);
	vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
	vec3 up = cross(forward, right);
	return normalize(forward + uv.x * right + uv.y * up);
}

vec3 spherical_coordinates(float phi, float theta, float radius) {
	float x = radius * cos(theta) * sin(phi);
	float y = radius * sin(theta);
	float z = radius * cos(theta) * cos(phi);
	return vec3(x, y, z);
}

void main() {
    vec2 uv = vec2(
		    gl_FragCoord.x / u_resolution.x * 2.0 - 1.0,
		    (gl_FragCoord.y / u_resolution.y * 2.0 - 1.0) * (u_resolution.y / u_resolution.x)
	);	// vec3 camera_position = spherical_coordinates(u_mouse.x * 3.1415, -u_mouse.y * 3.1415, 2.0);
	vec3 camera_position = spherical_coordinates(-u_time * 0.3 + u_camera.x, 0.5 + u_camera.y, u_zoom);
	
	vec3 camera_direction = normalize(vec3(0.0) - camera_position);
	
	vec3 sun_direction = spherical_coordinates(u_time * 0.5, 0.8, 1.0); // Sun moves over time

	vec3 ray_origin = camera_position;
	vec3 ray_dir = ray_direction(uv, camera_direction);

	vec3 t = perform_ray_march(ray_origin, ray_dir, sun_direction);
	vec4 color = vec4(0.0);
	if (t.x > -0.5) {
		color = vec4(t, 1.0);
	} else {
		color = vec4(0.0, 0.0, 0.0, 1.0); // Background color
	}
    gl_FragColor = color;
}
