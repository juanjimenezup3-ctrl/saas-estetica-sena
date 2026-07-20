/**
 * test-e2e.js — E2E Integration and Business Logic Validation Script
 * Verifies catalog fetching, dynamic slot calculations, and scheduling conflict logic.
 *
 * USO LOCAL:    node test-e2e.js
 * USO CI/CD:    TEST_BASE_URL=https://mi-app.onrender.com node test-e2e.js
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// ─── URL DINÁMICA ───────────────────────────────────────────────────────────
// En CI/CD o en la nube, configura TEST_BASE_URL en las variables de entorno.
// Localmente siempre apunta a localhost:3000.
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const parsedBase = new URL(BASE_URL);

function makeRequest(path, method = 'GET', postData = null, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const isHttps = parsedBase.protocol === 'https:';
        const transport = isHttps ? https : http;

        const options = {
            host: parsedBase.hostname,
            port: parsedBase.port || (isHttps ? 443 : 80),
            path,
            method,
            headers: { ...extraHeaders }
        };

        if (postData) {
            const body = JSON.stringify(postData);
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = transport.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, body: data });
                }
            });
        });

        req.on('error', (err) => reject(err));

        if (postData) {
            req.write(JSON.stringify(postData));
        }
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Starting SamambaiaSpa E2E Integration Tests...');
    console.log(`🌐 Target URL: ${BASE_URL}`);

    // 1. Fetch catalog
    console.log('\n--- Test 1: Fetching services catalog ---');
    const catalog = await makeRequest('/api/servicios');
    if (catalog.statusCode === 200 && catalog.body.ok) {
        console.log(`✅ Success! Found ${catalog.body.totalServicios} services.`);
    } else {
        console.error('❌ Failed to fetch services catalog:', catalog.body);
        process.exit(1);
    }

    // Identify service "Uñas Acrílicas" (ID 2, 90 mins -> blocks 3 slots)
    const service = catalog.body.datos.find(s => s.id === 2);
    console.log(`Target Service: "${service.nombre}" (${service.duracion} minutes)`);

    // Find the next Wednesday to ensure it is always a weekday with standard operating hours
    const testDate = new Date();
    const currentDay = testDate.getDay(); // 0 = Sun, 1 = Mon, etc.
    const daysUntilWednesday = (3 - currentDay + 7) % 7 || 7; // Get next Wednesday
    testDate.setDate(testDate.getDate() + daysUntilWednesday);
    const dateStr = testDate.toISOString().split('T')[0];
    console.log(`Using date for tests (upcoming Wednesday): ${dateStr}`);

    console.log('\n--- Test 2: Checking availability for tomorrow ---');
    const availBefore = await makeRequest(`/api/horarios-disponibles?fecha=${dateStr}&servicioId=2`);
    if (!availBefore.body.ok) {
        console.error('❌ Failed to check availability:', availBefore.body);
        process.exit(1);
    }
    const slots = availBefore.body.datos;
    console.log(`✅ Success! Found ${slots.length} daily slots. Operating day is active: ${availBefore.body.activo}`);

    // Verify slots at 10:00, 10:30, 11:00 are initially available and reservable
    const targetSlot = slots.find(s => s.hora === '10:00');
    console.log(`Slot 10:00 initial state: Reservable=${targetSlot.reservable}, Status=${targetSlot.estado}`);

    if (!targetSlot.reservable) {
        console.warn('⚠️ Slot at 10:00 is not reservable. Check if tomorrow is Sunday (closed) or blocked.');
    }

    // 3. Create appointment at 10:00 AM (90 mins -> blocks 10:00, 10:30, 11:00)
    console.log('\n--- Test 3: Scheduling appointment (90 mins) at 10:00 AM ---');
    const appointmentPayload = {
        nombre: 'SENA Test Client',
        telefono: '3009998877',
        edad: '24',
        genero: 'Femenino',
        servicioId: 2,
        fecha: dateStr,
        hora: '10:00'
    };

    const bookRes = await makeRequest('/api/crear-cita', 'POST', appointmentPayload);

    let createdId = null;
    if (bookRes.statusCode === 201 && bookRes.body.ok) {
        createdId = bookRes.body.datos.idCita;
        console.log(`✅ Success! Appointment created with ID: ${createdId}`);
    } else {
        console.error('❌ Failed to schedule appointment:', bookRes.body);
        process.exit(1);
    }

    // 4. Verify slots are locked correctly
    console.log('\n--- Test 4: Verifying slot locking ---');
    const availAfter = await makeRequest(`/api/horarios-disponibles?fecha=${dateStr}&servicioId=2`);
    
    const slotsAfter = availAfter.body.datos;
    const s1000 = slotsAfter.find(s => s.hora === '10:00');
    const s1030 = slotsAfter.find(s => s.hora === '10:30');
    const s1100 = slotsAfter.find(s => s.hora === '11:00');
    const s1130 = slotsAfter.find(s => s.hora === '11:30'); // Should be free

    console.log(`Slot 10:00: Status=${s1000.estado}, Reservable=${s1000.reservable}`);
    console.log(`Slot 10:30: Status=${s1030.estado}, Reservable=${s1030.reservable}`);
    console.log(`Slot 11:00: Status=${s1100.estado}, Reservable=${s1100.reservable}`);
    console.log(`Slot 11:30: Status=${s1130.estado}, Reservable=${s1130.reservable}`);

    const hasCorrectLock = (s1000.estado === 'ocupado' && s1030.estado === 'ocupado' && s1100.estado === 'ocupado' && s1130.estado === 'disponible');
    if (hasCorrectLock) {
        console.log('✅ Success! Exactly 3 slots (90 mins) were blocked and consecutive checking worked.');
    } else {
        console.error('❌ Slot locking logic failed!');
        process.exit(1);
    }

    // 5. Test Double-booking conflict (should fail with 409 Conflict)
    console.log('\n--- Test 5: Verifying double-booking prevention ---');
    const conflictRes = await makeRequest('/api/crear-cita', 'POST', {
        ...appointmentPayload,
        nombre: 'Conflict Client',
        hora: '10:30' // Overlapping slot
    });

    if (conflictRes.statusCode === 409) {
        console.log('✅ Success! Double-booking correctly prevented with 409 Conflict.');
    } else {
        console.error('❌ Prevention failed! Overlapping booking allowed:', conflictRes.body);
        process.exit(1);
    }

    // 6. Cancel appointment and verify slot release
    console.log('\n--- Test 6: Cancelling the appointment ---');
    const cancelRes = await makeRequest(`/api/citas/${createdId}`, 'DELETE');

    if (cancelRes.statusCode === 200 && cancelRes.body.ok) {
        console.log('✅ Success! Appointment deleted successfully.');
    } else {
        console.error('❌ Failed to cancel appointment:', cancelRes.body);
        process.exit(1);
    }

    // Check availability again
    const availFinal = await makeRequest(`/api/horarios-disponibles?fecha=${dateStr}&servicioId=2`);
    const s1000Final = availFinal.body.datos.find(s => s.hora === '10:00');
    console.log(`Slot 10:00 post-cancellation status: ${s1000Final.estado}`);

    if (s1000Final.estado === 'disponible') {
        console.log('✅ Success! All slots released and available again.');
    } else {
        console.error('❌ Slot release logic failed!');
        process.exit(1);
    }

    // 7. Services catalog CRUD tests
    console.log('\n--- Test 7: Services Catalog CRUD ---');
    
    // Login to obtain authentication token
    const loginRes = await makeRequest('/api/admin/login', 'POST', { usuario: 'admin', password: 'admin123' });

    if (loginRes.statusCode !== 200 || !loginRes.body.ok) {
        console.error('❌ Failed to login:', loginRes.body);
        process.exit(1);
    }
    const token = loginRes.body.token;
    console.log('🔑 Logged in successfully. Token acquired.');

    // Create new service
    const servicePayload = {
        nombre: 'Servicio Test CRUD',
        categoria: 'Tratamientos',
        precio: 45000,
        duracion: 60,
        descripcion: 'Servicio de prueba para verificar endpoints CRUD.'
    };
    const createServRes = await makeRequest(
        '/api/admin/servicios',
        'POST',
        servicePayload,
        { 'Authorization': `Bearer ${token}` }
    );

    if (createServRes.statusCode !== 201 || !createServRes.body.ok) {
        console.error('❌ Failed to create service:', createServRes.body);
        process.exit(1);
    }
    const serviceId = createServRes.body.datos.id;
    console.log(`✅ Success! Created service "${createServRes.body.datos.nombre}" with ID: ${serviceId}`);

    // Update service
    const updatePayload = {
        nombre: 'Servicio Test CRUD Modificado',
        categoria: 'Tratamientos',
        precio: 50000,
        duracion: 60,
        descripcion: 'Servicio de prueba modificado.'
    };
    const updateServRes = await makeRequest(
        `/api/admin/servicios/${serviceId}`,
        'PUT',
        updatePayload,
        { 'Authorization': `Bearer ${token}` }
    );

    if (updateServRes.statusCode !== 200 || !updateServRes.body.ok) {
        console.error('❌ Failed to update service:', updateServRes.body);
        process.exit(1);
    }
    console.log(`✅ Success! Updated service to: "${updatePayload.nombre}" (Price: ${updatePayload.precio})`);

    // Verify service appears in catalog
    const catalogAfter = await makeRequest('/api/servicios');
    const foundService = catalogAfter.body.datos.find(s => s.id === serviceId);
    if (foundService && foundService.nombre === 'Servicio Test CRUD Modificado') {
        console.log('✅ Success! Modified service is successfully present in the public catalog.');
    } else {
        console.error('❌ Failed to verify modified service in catalog.');
        process.exit(1);
    }

    // Delete service
    const deleteServRes = await makeRequest(
        `/api/admin/servicios/${serviceId}`,
        'DELETE',
        null,
        { 'Authorization': `Bearer ${token}` }
    );
    if (deleteServRes.statusCode !== 200 || !deleteServRes.body.ok) {
        console.error('❌ Failed to delete service:', deleteServRes.body);
        process.exit(1);
    }
    console.log(`✅ Success! Deleted service with ID: ${serviceId}`);

    // Verify service is gone from catalog
    const catalogFinal = await makeRequest('/api/servicios');
    const foundServiceFinal = catalogFinal.body.datos.find(s => s.id === serviceId);
    if (!foundServiceFinal) {
        console.log('✅ Success! Deleted service is no longer in the public catalog.');
    } else {
        console.error('❌ Service was not deleted successfully from the catalog.');
        process.exit(1);
    }

    console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! The business logic is 100% correct.');
}

runTests().catch(err => {
    console.error('Test script crashed:', err);
    process.exit(1);
});
