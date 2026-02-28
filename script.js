function lerp(a, b, t) {
	return a + (b - a) * t;
}

const t0 = performance.now();

const vertexShaderSrc = `
attribute vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const shaders = {
	mandelbrot: 'shaders/mandelbrot.frag',
	raymarch: 'shaders/raymarch.frag',
};

const dropdown = document.getElementById('shaderSelect');
for (const key in shaders) {
	const option = document.createElement('option');
	option.value = shaders[key];
	option.text = key.charAt(0).toUpperCase() + key.slice(1);
	dropdown.appendChild(option);
}

// Load fragment shader from external file
async function loadShader(url) {
	const res = await fetch(url);
	return await res.text();
}

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl');
if (!gl) alert('WebGL not supported!');

function compileShader(src, type) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, src);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(shader));
		return null;
	}
	return shader;
}

function createProgram(vs, fs) {
	const program = gl.createProgram();
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error(gl.getProgramInfoLog(program));
	}
	return program;
}

// Create buffer for fullscreen quad
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
	-1, -1, 1, -1, -1, 1,
	-1, 1, 1, -1, 1, 1
]), gl.STATIC_DRAW);

// Resize canvas
function resizeCanvas() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let mouse = [0, 0];
let globalMouse = [0, 0];
let zoom = 1.0;
let camera = [0, 0];

// Dragging state
let isDragging = false;
let lastMouse = [0, 0];

// Mouse move + dragging
window.addEventListener('mousemove', (e) => {

	// ---- Camera dragging ----
	if (isDragging) {
		const dx = lastMouse[0] - e.clientX;
		const dy = lastMouse[1] - e.clientY;

		const aspect = window.innerHeight / window.innerWidth;

		camera[0] -= (dx / window.innerWidth) * 2 * zoom;
		camera[1] += (dy / window.innerHeight) * 2 * zoom * aspect;

		lastMouse = [e.clientX, e.clientY];
	}

	mouse = [
		e.clientX / window.innerWidth * 2 - 1,
		e.clientY / window.innerHeight * -2 + 1
	];

	mouse[1] *= window.innerHeight / window.innerWidth;

	globalMouse = [
		mouse[0] * zoom + camera[0],
		mouse[1] * zoom + camera[1]
	];
});

window.addEventListener('mousedown', (e) => {
	isDragging = true;
	lastMouse = [e.clientX, e.clientY];
});

window.addEventListener('mouseup', () => {
	isDragging = false;
});

window.addEventListener('mouseleave', () => {
	isDragging = false;
});

window.addEventListener('wheel', (e) => {
	e.preventDefault();

	const delta = e.deltaY / 500;
	zoom *= 1 + delta;

	iterations = Math.log(zoom) * 50 + 100;

	globalMouse = [
		mouse[0] * zoom + camera[0],
		mouse[1] * zoom + camera[1]
	];

	camera[0] = lerp(camera[0], globalMouse[0], delta);
	camera[1] = lerp(camera[1], globalMouse[1], delta);

}, { passive: false });


async function main() {
	const fragmentShaderSrc = await loadShader(dropdown.value);

	const vertexShader = compileShader(vertexShaderSrc, gl.VERTEX_SHADER);
	const fragmentShader = compileShader(fragmentShaderSrc, gl.FRAGMENT_SHADER);
	const program = createProgram(vertexShader, fragmentShader);

	const a_position = gl.getAttribLocation(program, 'a_position');
	const u_resolution = gl.getUniformLocation(program, 'u_resolution');
	const u_mouse = gl.getUniformLocation(program, 'u_mouse');
	const u_zoom = gl.getUniformLocation(program, 'u_zoom');
	const u_camera = gl.getUniformLocation(program, 'u_camera');
	const u_time = gl.getUniformLocation(program, 'u_time');

	function render() {
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.useProgram(program);

		gl.enableVertexAttribArray(a_position);
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);

		gl.uniform2f(u_resolution, canvas.width, canvas.height);
		gl.uniform2f(u_mouse, mouse[0], mouse[1]);
		gl.uniform1f(u_zoom, zoom);
		gl.uniform2f(u_camera, camera[0], camera[1]);

		let time = (performance.now() - t0) / 1000;
		gl.uniform1f(u_time, time);

		gl.drawArrays(gl.TRIANGLES, 0, 6);
		requestAnimationFrame(render);
	}

	render();
}

main();
dropdown.addEventListener('change', main);
