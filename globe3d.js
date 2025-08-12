import * as THREE from "three";
import { OrbitControls } from 'jsm/controls/OrbitControls.js';

import getStarfield from "./src/getStarfield.js";
import { getFresnelMat } from "./src/getFresnelMat.js";

// 1. เลือก div ที่เราจะใช้เป็นคอนเทนเนอร์
const container = document.getElementById('globe3d-container'); // <-- เปลี่ยนแปลง

// 2. ใช้ขนาดของ container แทน window
const w = container.clientWidth; // <-- เปลี่ยนแปลง
const h = container.clientHeight; // <-- เปลี่ยนแปลง

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.z = 2; // 5

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(w, h);

// 3. นำ renderer.domElement (canvas) ไปใส่ใน container ของเรา
container.appendChild(renderer.domElement); // <-- เปลี่ยนแปลง

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const earthGroup = new THREE.Group();
//earthGroup.rotation.z = -23.4 * Math.PI / 180;
earthGroup.rotation.z = -10 * Math.PI / 180;
scene.add(earthGroup);

new OrbitControls(camera, renderer.domElement);
const detail = 12;
const loader = new THREE.TextureLoader();
const geometry = new THREE.IcosahedronGeometry(1, detail);
const material = new THREE.MeshPhongMaterial({
    map: loader.load("./img/textures/00_earthmap1k.jpg"),
    specularMap: loader.load("./img/textures/02_earthspec1k.jpg"),
    bumpMap: loader.load("./img/textures/01_earthbump1k.jpg"),
    bumpScale: 0.04,
});
const earthMesh = new THREE.Mesh(geometry, material);
earthGroup.add(earthMesh);

const lightsMat = new THREE.MeshBasicMaterial({
    map: loader.load("./img/textures/03_earthlights1k.jpg"),
    blending: THREE.AdditiveBlending,
});
const lightsMesh = new THREE.Mesh(geometry, lightsMat);
earthGroup.add(lightsMesh);

const cloudsMat = new THREE.MeshStandardMaterial({
    map: loader.load("./img/textures/04_earthcloudmap.jpg"),
    transparent: true,
    opacity: 0.5, // 0.8
    blending: THREE.AdditiveBlending,
    alphaMap: loader.load('./img/textures/05_earthcloudmaptrans.jpg'),
});
const cloudsMesh = new THREE.Mesh(geometry, cloudsMat);
cloudsMesh.scale.setScalar(1.003);
earthGroup.add(cloudsMesh);

const fresnelMat = getFresnelMat({ rimHex: 0xA4CCFF, facingHex: 0x000000 });
const glowMesh = new THREE.Mesh(geometry, fresnelMat);
glowMesh.scale.setScalar(1.01);
earthGroup.add(glowMesh);

const fresnelMat2 = getFresnelMat({ rimHex: 0x000000, facingHex: 0x000000 });
const glowMesh2 = new THREE.Mesh(geometry, fresnelMat2);
glowMesh2.scale.setScalar(1.05);
earthGroup.add(glowMesh2);
/*
const stars = getStarfield({numStars: 2000});
scene.add(stars);
*/
const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
sunLight.position.set(-2, 0.5, 1.5);
scene.add(sunLight);

function animate() {
    requestAnimationFrame(animate);

    earthMesh.rotation.y += 0.002;
    lightsMesh.rotation.y += 0.002;
    cloudsMesh.rotation.y += 0.0023;
    glowMesh.rotation.y += 0.002;
    //stars.rotation.y -= 0.0002;
    renderer.render(scene, camera);
}

animate();

// 4. แก้ไขฟังก์ชัน resize ให้ใช้ขนาดของ container
function handleWindowResize() {
    // ดึงขนาดใหม่ของ container
    const newW = container.clientWidth; // <-- เปลี่ยนแปลง
    const newH = container.clientHeight; // <-- เปลี่ยนแปลง

    // อัปเดต camera aspect ratio
    camera.aspect = newW / newH; // <-- เปลี่ยนแปลง
    camera.updateProjectionMatrix();

    // อัปเดตขนาด renderer
    renderer.setSize(newW, newH); // <-- เปลี่ยนแปลง
}
//window.addEventListener('resize', handleWindowResize, false);