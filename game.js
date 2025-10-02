// Three.js와 Cannon.js 설정
let scene, camera, renderer;
let world;
let spheres = [];
let pins = []; // 압정 배열
let ground, groundBody;
let paintSplatCanvas, paintSplatTexture; // 물감 효과용 캔버스
let cameraMode = 'far'; // 'far', 'close', 'pov', 'random'
let targetSphere = null;
let keys = {};
let smoothCenterOfMass = new THREE.Vector3(0, 10, 0); // 부드러운 무게중심

// 초기화
function init() {
    // Three.js 장면
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 50, 200);

    // 카메라
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 30, 50);
    camera.lookAt(0, 0, 0);

    // 렌더러
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio * 1.5); // 해상도 향상
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Cannon.js 물리 세계
    world = new CANNON.World();
    world.gravity.set(0, -20, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;

    // 조명
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 50, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // 포인트 라이트 (구슬 주변)
    const pointLight = new THREE.PointLight(0x6666ff, 1, 100);
    pointLight.position.set(0, 20, 0);
    scene.add(pointLight);

    // 바닥 생성
    createGround();

    // 벽 생성
    createWalls();

    // 파티클 배경
    createStars();

    // 초기 구슬 생성
    for (let i = 0; i < 5; i++) {
        setTimeout(() => createSphere(), i * 200);
    }

    // 이벤트 리스너
    window.addEventListener('resize', onWindowResize);
    setupKeyboardControls();
    setupButtonControls();
    setupPasteListener();

    // 애니메이션 시작
    animate();
}

// 바닥 생성
function createGround() {
    // 물감 텍스처용 캔버스 생성
    paintSplatCanvas = document.createElement('canvas');
    paintSplatCanvas.width = 2048;
    paintSplatCanvas.height = 2048;
    const ctx = paintSplatCanvas.getContext('2d');

    // 초기 바닥 색상
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(0, 0, paintSplatCanvas.width, paintSplatCanvas.height);

    // Three.js 텍스처 생성
    paintSplatTexture = new THREE.CanvasTexture(paintSplatCanvas);
    paintSplatTexture.needsUpdate = true;

    // Three.js 바닥
    const groundGeometry = new THREE.BoxGeometry(80, 1, 80);
    const groundMaterial = new THREE.MeshStandardMaterial({
        map: paintSplatTexture,
        roughness: 0.8,
        metalness: 0.2
    });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Cannon.js 바닥
    const groundShape = new CANNON.Box(new CANNON.Vec3(40, 0.5, 40));
    groundBody = new CANNON.Body({
        mass: 0,
        shape: groundShape,
        material: new CANNON.Material()
    });
    groundBody.position.set(0, -0.5, 0);
    world.addBody(groundBody);
}

// 벽 생성
function createWalls() {
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a3a5a,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });

    const wallHeight = 50;
    const wallThickness = 1;
    const wallDistance = 40;

    const walls = [
        { x: wallDistance, y: wallHeight/2, z: 0, width: wallThickness, height: wallHeight, depth: 80 },
        { x: -wallDistance, y: wallHeight/2, z: 0, width: wallThickness, height: wallHeight, depth: 80 },
        { x: 0, y: wallHeight/2, z: wallDistance, width: 80, height: wallHeight, depth: wallThickness },
        { x: 0, y: wallHeight/2, z: -wallDistance, width: 80, height: wallHeight, depth: wallThickness }
    ];

    walls.forEach(w => {
        // Three.js 벽
        const wallGeometry = new THREE.BoxGeometry(w.width, w.height, w.depth);
        const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
        wallMesh.position.set(w.x, w.y, w.z);
        scene.add(wallMesh);

        // Cannon.js 벽
        const wallShape = new CANNON.Box(new CANNON.Vec3(w.width/2, w.height/2, w.depth/2));
        const wallBody = new CANNON.Body({
            mass: 0,
            shape: wallShape
        });
        wallBody.position.set(w.x, w.y, w.z);
        world.addBody(wallBody);
    });
}

// 별 배경
function createStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.5,
        transparent: true,
        opacity: 0.8
    });

    const starsVertices = [];
    for (let i = 0; i < 1000; i++) {
        const x = (Math.random() - 0.5) * 200;
        const y = Math.random() * 100 + 20;
        const z = (Math.random() - 0.5) * 200;
        starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
}

// 풍선 생성
function createSphere() {
    const radius = Math.random() * 1.5 + 1;

    // Three.js 풍선
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    const hue = Math.random();
    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(hue, 0.8, 0.6),
        roughness: 0.3,
        metalness: 0.7,
        emissive: new THREE.Color().setHSL(hue, 0.5, 0.2)
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 랜덤 위치에서 생성
    const startX = (Math.random() - 0.5) * 60;
    const startZ = (Math.random() - 0.5) * 60;
    const startY = Math.random() * 20 + 40;
    mesh.position.set(startX, startY, startZ);

    scene.add(mesh);

    // Cannon.js 물리 바디
    const shape = new CANNON.Sphere(radius);
    const body = new CANNON.Body({
        mass: radius * radius * 4,
        shape: shape,
        linearDamping: 0.1,
        angularDamping: 0.1,
        material: new CANNON.Material()
    });
    body.position.set(startX, startY, startZ);

    // 초기 회전 속도
    body.angularVelocity.set(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5
    );

    world.addBody(body);

    // 충돌 반발 설정
    const contactMaterial = new CANNON.ContactMaterial(
        body.material,
        groundBody.material,
        {
            friction: 0.3,
            restitution: 0.6
        }
    );
    world.addContactMaterial(contactMaterial);

    spheres.push({ mesh, body, radius, popped: false });

    updateUI();
}

// 압정 생성
function createPin() {
    // Three.js 압정 모델
    const pinGroup = new THREE.Group();

    // 압정 몸통 (원뿔)
    const coneGeometry = new THREE.ConeGeometry(0.3, 1.5, 8);
    const coneMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        metalness: 0.8,
        roughness: 0.2
    });
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.rotation.x = Math.PI;
    cone.castShadow = true;
    pinGroup.add(cone);

    // 압정 머리 (구)
    const headGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        metalness: 0.6,
        roughness: 0.3
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 0.75;
    head.castShadow = true;
    pinGroup.add(head);

    // 랜덤 위치에서 생성
    const startX = (Math.random() - 0.5) * 60;
    const startZ = (Math.random() - 0.5) * 60;
    const startY = 60;
    pinGroup.position.set(startX, startY, startZ);

    scene.add(pinGroup);

    // Cannon.js 물리 바디 (원뿔형태 대신 작은 구 사용)
    const shape = new CANNON.Sphere(0.3);
    const body = new CANNON.Body({
        mass: 0.5,
        shape: shape,
        linearDamping: 0.1,
        angularDamping: 0.3
    });
    body.position.set(startX, startY, startZ);

    world.addBody(body);

    pins.push({ mesh: pinGroup, body });
}

// 풍선 터트리기
function popBalloon(balloon) {
    if (balloon.popped) return;

    balloon.popped = true;

    // 터지는 애니메이션 (파티클)
    createPopEffect(balloon.mesh.position, balloon.mesh.material.color);

    // 바닥에 물감 뿌리기
    paintGroundSplat(balloon.mesh.position, balloon.mesh.material.color);

    // 풍선 제거
    scene.remove(balloon.mesh);
    world.removeBody(balloon.body);

    const index = spheres.indexOf(balloon);
    if (index > -1) {
        spheres.splice(index, 1);
    }

    if (targetSphere === balloon) {
        targetSphere = null;
    }
}

// 터지는 효과
function createPopEffect(position, color) {
    const particleCount = 30;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.SphereGeometry(0.15, 8, 8);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5
        });
        const particle = new THREE.Mesh(geometry, material);

        particle.position.copy(position);

        // 더 강한 폭발 효과
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 15,
            Math.random() * 8 - 2, // 주로 아래로
            (Math.random() - 0.5) * 15
        );
        particle.userData.velocity = velocity;
        particle.userData.lifetime = 1.5;
        particle.userData.isPaint = true;

        scene.add(particle);
        particles.push(particle);
    }

    // 파티클 애니메이션
    const animateParticles = () => {
        particles.forEach((particle, index) => {
            particle.userData.lifetime -= 0.02;

            if (particle.userData.lifetime <= 0) {
                scene.remove(particle);
                particles.splice(index, 1);
            } else {
                particle.position.add(particle.userData.velocity.clone().multiplyScalar(0.02));
                particle.userData.velocity.y -= 0.8; // 강한 중력
                particle.material.opacity = particle.userData.lifetime / 1.5;
                particle.material.transparent = true;

                // 바닥에 닿으면 물감 자국 추가
                if (particle.position.y <= 0 && particle.userData.isPaint) {
                    particle.userData.isPaint = false;
                    paintGroundSplat(particle.position, color, 2);
                }
            }
        });

        if (particles.length > 0) {
            requestAnimationFrame(animateParticles);
        }
    };

    animateParticles();
}

// 바닥에 물감 뿌리기
function paintGroundSplat(position, color, size = 5) {
    const ctx = paintSplatCanvas.getContext('2d');

    // 3D 위치를 2D 캔버스 좌표로 변환
    // 바닥은 80x80 크기이고, 캔버스는 2048x2048
    const scale = paintSplatCanvas.width / 80;
    const x = (position.x + 40) * scale;
    const z = (position.z + 40) * scale;

    // 색상 변환
    const colorHex = '#' + color.getHexString();

    // 물감이 튄 효과 (여러 개의 불규칙한 원)
    const splatCount = Math.floor(Math.random() * 8 + 12);

    for (let i = 0; i < splatCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * size * scale;
        const splatX = x + Math.cos(angle) * distance;
        const splatZ = z + Math.sin(angle) * distance;
        const splatSize = (Math.random() * size + size * 0.5) * scale;

        // 그라디언트로 부드러운 물감 효과
        const gradient = ctx.createRadialGradient(
            splatX, splatZ, 0,
            splatX, splatZ, splatSize
        );

        // 투명도를 다양하게
        const alpha = Math.random() * 0.4 + 0.4;
        const colorRgb = color.getStyle();

        gradient.addColorStop(0, colorHex);
        gradient.addColorStop(0.5, colorHex + Math.floor(alpha * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(splatX, splatZ, splatSize, 0, Math.PI * 2);
        ctx.fill();
    }

    // 중심에 더 진한 물감
    const centerGradient = ctx.createRadialGradient(
        x, z, 0,
        x, z, size * scale * 1.5
    );
    centerGradient.addColorStop(0, colorHex);
    centerGradient.addColorStop(0.6, colorHex + '99');
    centerGradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.arc(x, z, size * scale * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 텍스처 업데이트
    paintSplatTexture.needsUpdate = true;
}

// 충돌 체크
function checkCollisions() {
    pins.forEach((pin, pinIndex) => {
        spheres.forEach(balloon => {
            if (balloon.popped) return;

            const distance = pin.body.position.distanceTo(balloon.body.position);

            // 압정과 풍선이 충돌하면
            if (distance < balloon.radius + 0.5) {
                popBalloon(balloon);

                // 압정도 제거
                scene.remove(pin.mesh);
                world.removeBody(pin.body);
                pins.splice(pinIndex, 1);
            }
        });

        // 압정이 바닥 아래로 떨어지면 제거
        if (pin.body.position.y < -10) {
            scene.remove(pin.mesh);
            world.removeBody(pin.body);
            pins.splice(pinIndex, 1);
        }
    });
}

// 키보드 컨트롤
function setupKeyboardControls() {
    const handleKeyDown = (e) => {
        e.preventDefault();

        if (e.key === ' ') {
            createSphere();
        } else if (e.key === 'q' || e.key === 'Q') {
            createPin();
        } else if (e.key === 'r' || e.key === 'R') {
            removeAllSpheres();
        } else if (e.key === '1') {
            setCameraMode('far');
        } else if (e.key === '2') {
            setCameraMode('close');
        } else if (e.key === '3') {
            setCameraMode('pov');
        } else if (e.key === '4') {
            setCameraMode('random');
        }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
}

// 버튼 컨트롤
function setupButtonControls() {
    // 버튼이 없으므로 빈 함수
}

// 붙여넣기 이벤트 리스너
function setupPasteListener() {
    window.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text');
        if (text && text.trim()) {
            createTextMesh(text.trim());
        }
    });
}

// 3D 텍스트 생성
function createTextMesh(text) {
    // 캔버스에 텍스트 렌더링
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 캔버스 크기 설정
    canvas.width = 512;
    canvas.height = 256;

    // 배경
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 텍스트 스타일
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 텍스트 줄바꿈 처리
    const maxWidth = canvas.width - 40;
    const words = text.split(' ');
    let lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth) {
            lines.push(currentLine);
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine);

    // 텍스트 그리기
    const lineHeight = 60;
    const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });

    // 테두리
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // 텍스처 생성
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // 평면 메시 생성
    const geometry = new THREE.PlaneGeometry(10, 5);
    const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.5,
        metalness: 0.1
    });
    const mesh = new THREE.Mesh(geometry, material);

    // 랜덤 위치에서 떨어지기
    const startX = (Math.random() - 0.5) * 60;
    const startZ = (Math.random() - 0.5) * 60;
    const posY = 50;
    mesh.position.set(startX, posY, startZ);

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = false;

    scene.add(mesh);

    // 물리 바디 생성
    const shape = new CANNON.Box(new CANNON.Vec3(5, 2.5, 0.1));
    const body = new CANNON.Body({
        mass: 2,
        shape: shape,
        linearDamping: 0.3,
        angularDamping: 0.5
    });
    body.position.set(startX, startY, startZ);

    // 초기 회전
    body.angularVelocity.set(
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3
    );

    world.addBody(body);

    // 텍스트 객체 추가 (일반 구슬과 다른 배열에 저장)
    if (!window.textObjects) {
        window.textObjects = [];
    }
    window.textObjects.push({ mesh, body });
}

// 카메라 모드 설정
function setCameraMode(mode) {
    cameraMode = mode;

    switch(mode) {
        case 'far':
            break;
        case 'close':
            break;
        case 'pov':
            selectTargetSphere();
            break;
        case 'random':
            selectRandomSphere();
            break;
    }
}

// 타겟 구슬 선택 (첫 번째)
function selectTargetSphere() {
    if (spheres.length > 0) {
        targetSphere = spheres[0];
    }
}

// 랜덤 구슬 선택
function selectRandomSphere() {
    if (spheres.length > 0) {
        const randomIndex = Math.floor(Math.random() * spheres.length);
        targetSphere = spheres[randomIndex];
    }
}

// 모든 구슬 제거
function removeAllSpheres() {
    spheres.forEach(sphere => {
        scene.remove(sphere.mesh);
        world.removeBody(sphere.body);
    });
    spheres = [];

    pins.forEach(pin => {
        scene.remove(pin.mesh);
        world.removeBody(pin.body);
    });
    pins = [];

    // 텍스트 객체도 제거
    if (window.textObjects) {
        window.textObjects.forEach(textObj => {
            scene.remove(textObj.mesh);
            world.removeBody(textObj.body);
        });
        window.textObjects = [];
    }

    // 바닥 물감도 초기화
    const ctx = paintSplatCanvas.getContext('2d');
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(0, 0, paintSplatCanvas.width, paintSplatCanvas.height);
    paintSplatTexture.needsUpdate = true;

    targetSphere = null;
    updateUI();
}

// 카메라 업데이트
function updateCamera() {
    const centerOfMass = calculateCenterOfMass();

    // 무게중심을 부드럽게 업데이트
    smoothCenterOfMass.lerp(centerOfMass, 0.02);

    switch(cameraMode) {
        case 'far':
            // 멀리서 전체 보기
            const targetPosFar = new THREE.Vector3(0, 30, 50);
            camera.position.lerp(targetPosFar, 0.05);
            camera.lookAt(smoothCenterOfMass);
            break;

        case 'close':
            // 가까이서 보기
            const targetPosClose = new THREE.Vector3(
                smoothCenterOfMass.x + 15,
                smoothCenterOfMass.y + 15,
                smoothCenterOfMass.z + 15
            );
            camera.position.lerp(targetPosClose, 0.05);
            camera.lookAt(smoothCenterOfMass);
            break;

        case 'pov':
            // 특정 구슬 시점
            if (targetSphere && spheres.includes(targetSphere)) {
                const spherePos = targetSphere.mesh.position;
                const offset = new THREE.Vector3(0, 2, 5);
                const targetPos = spherePos.clone().add(offset);
                camera.position.lerp(targetPos, 0.1);
                camera.lookAt(spherePos);
            } else {
                selectTargetSphere();
            }
            break;

        case 'random':
            // 랜덤 구슬 시점 (3초마다 변경)
            if (!targetSphere || !spheres.includes(targetSphere) || Math.random() < 0.005) {
                selectRandomSphere();
            }
            if (targetSphere) {
                const spherePos = targetSphere.mesh.position;
                const offset = new THREE.Vector3(
                    Math.sin(Date.now() * 0.001) * 5,
                    3,
                    Math.cos(Date.now() * 0.001) * 5
                );
                const targetPos = spherePos.clone().add(offset);
                camera.position.lerp(targetPos, 0.08);
                camera.lookAt(spherePos);
            }
            break;
    }
}

// 구슬들의 무게중심 계산
function calculateCenterOfMass() {
    if (spheres.length === 0) {
        return new THREE.Vector3(0, 10, 0);
    }

    const center = new THREE.Vector3();
    spheres.forEach(sphere => {
        center.add(sphere.mesh.position);
    });
    center.divideScalar(spheres.length);
    return center;
}

// UI 업데이트
function updateUI() {
    // UI 요소가 없으므로 빈 함수
}

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);

    // 물리 업데이트
    world.step(1/60);

    // 구슬 위치 동기화 및 범위 체크
    spheres.forEach((sphere, index) => {
        if (!sphere.popped) {
            sphere.mesh.position.copy(sphere.body.position);
            sphere.mesh.quaternion.copy(sphere.body.quaternion);

            // 바닥 아래로 떨어진 구슬 제거
            if (sphere.body.position.y < -10) {
                scene.remove(sphere.mesh);
                world.removeBody(sphere.body);
                spheres.splice(index, 1);
                if (targetSphere === sphere) {
                    targetSphere = null;
                }
            }
        }
    });

    // 압정 위치 동기화
    pins.forEach(pin => {
        pin.mesh.position.copy(pin.body.position);
        pin.mesh.quaternion.copy(pin.body.quaternion);
    });

    // 텍스트 객체 위치 동기화
    if (window.textObjects) {
        window.textObjects.forEach((textObj, index) => {
            textObj.mesh.position.copy(textObj.body.position);
            textObj.mesh.quaternion.copy(textObj.body.quaternion);

            // 바닥 아래로 떨어진 텍스트 제거
            if (textObj.body.position.y < -10) {
                scene.remove(textObj.mesh);
                world.removeBody(textObj.body);
                window.textObjects.splice(index, 1);
            }
        });
    }

    // 충돌 체크
    checkCollisions();

    // 카메라 업데이트
    updateCamera();

    // UI 업데이트
    updateUI();

    // 렌더링
    renderer.render(scene, camera);
}

// 창 크기 조정
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 자동 키 입력
setInterval(() => {
    createPin(); // Q 키
}, 1000);

setInterval(() => {
    createSphere(); // 스페이스바
}, 500);

// 시작
init();
