#ifdef GL_ES
precision highp float;
#endif

uniform float u_zoom;
uniform vec2 u_mouse;
uniform vec2 u_resolution;
uniform vec2 u_camera;

vec2 complex_mul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec4 find_mandelbrot(vec2 c) {
    vec2 z = vec2(0.0);
    int iterations = 0;
    const int max_iterations = 100;
	for (int i = 0; i < max_iterations; i++) {
        if (length(z) > 2.0) break;
        z = complex_mul(z, z) + c;
        iterations++;
    }
    float t = float(iterations) / float(max_iterations);
    return vec4(t, t * t, t * t * t, 1.0);
}

void main() {
    vec2 uv = (gl_FragCoord.xy / u_resolution.x) * 2.0 - 1.0;

    vec2 mouse_uv = u_mouse;

    vec2 c = uv * u_zoom - u_camera;

    vec4 color = find_mandelbrot(c);
    gl_FragColor = color;
}
