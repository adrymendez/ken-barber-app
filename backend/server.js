require('dotenv').config();
const XLSX = require('xlsx');
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   TEST
========================= */

app.get('/', (req, res) => {
    res.send('KEN BARBER API funcionando');
});

app.get('/api/test', async (req, res) => {

    try {

        const result = await pool.query('SELECT NOW()');

        res.json({
            ok: true,
            message: 'Base de datos conectada',
            time: result.rows[0]
        });

    } catch (error) {

        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

/* =========================
   OBTENER BARBEROS
========================= */

app.get('/api/medicos', async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT * FROM medicos
            ORDER BY id DESC
        `);

        res.json({
            ok: true,
            data: result.rows
        });

    } catch (error) {

        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

/* =========================
   CREAR BARBERO
========================= */

app.post('/api/medicos', async (req, res) => {

    try {

        const { nombre, especialidad } = req.body;

        const result = await pool.query(`
            INSERT INTO medicos(nombre, especialidad)
            VALUES($1,$2)
            RETURNING *
        `, [nombre, especialidad]);

        res.json({
            ok: true,
            data: result.rows[0]
        });

    } catch (error) {

        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});
/* =========================
   EDITAR BARBERO
========================= */

app.put('/api/medicos/:id', async (req, res) => {

    try {

        const { id } = req.params;
        const { nombre, especialidad } = req.body;

        const result = await pool.query(`
            UPDATE medicos
            SET
                nombre = $1,
                especialidad = $2
            WHERE id = $3
            RETURNING *
        `, [
            nombre,
            especialidad,
            id
        ]);

        res.json({
            ok: true,
            data: result.rows[0]
        });

    } catch (error) {

        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

/* =========================
   ELIMINAR BARBERO
========================= */

app.delete('/api/medicos/:id', async (req, res) => {

    try {

        const { id } = req.params;

        await pool.query(`
            DELETE FROM medicos
            WHERE id = $1
        `, [id]);

        res.json({
            ok: true
        });

    } catch (error) {

        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});


/* =========================
   OBTENER CITAS
========================= */

app.get('/api/citas', async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT * FROM citas
            ORDER BY fecha ASC, hora ASC
        `);

        res.json({
            ok: true,
            data: result.rows
        });

    } catch (error) {

        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

/* =========================
   CREAR CITA
========================= */

app.post('/api/citas', async (req, res) => {

    try {

        const {
            nombre,
            telefono,
            email,
            servicio,
            medico,
            fecha,
            hora
        } = req.body;

        const result = await pool.query(`
            INSERT INTO citas(
                nombre,
                telefono,
                email,
                servicio,
                medico,
                fecha,
                hora
            )
            VALUES($1,$2,$3,$4,$5,$6,$7)
            RETURNING *
        `, [
            nombre,
            telefono,
            email || null,
            servicio,
            medico,
            fecha,
            hora
        ]);

        // Limpiar teléfono
        const telefonoLimpio = telefono.replace(/\D/g, '');

        // Mensaje WhatsApp
        const mensaje = encodeURIComponent(
`Hola ${nombre}, tu cita en KEN BARBER fue confirmada.

📅 Fecha: ${fecha}
⏰ Hora: ${hora}
💈 Servicio: ${servicio}
👤 Barbero: ${medico}

Gracias por reservar con nosotros.`
        );

        // Link WhatsApp
        const waLink = `https://wa.me/${telefonoLimpio}?text=${mensaje}`;

        res.json({
            ok: true,
            data: {
                ...result.rows[0],
                waMode: 'wa_me',
                waLink
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

/* =========================
   ELIMINAR CITA
========================= */

app.delete('/api/citas/:id', async (req, res) => {

    try {

        const { id } = req.params;

        await pool.query(`
            DELETE FROM citas
            WHERE id = $1
        `, [id]);

        res.json({
            ok: true
        });

    } catch (error) {

        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

/* =========================
   EDITAR CITA
========================= */

app.put('/api/citas/:id', async (req, res) => {

    try {

        const { id } = req.params;

        const {
            nombre,
            telefono,
            fecha,
            hora
        } = req.body;

        const result = await pool.query(`
            UPDATE citas
            SET
                nombre = $1,
                telefono = $2,
                fecha = $3,
                hora = $4
            WHERE id = $5
            RETURNING *
        `, [
            nombre,
            telefono,
            fecha,
            hora,
            id
        ]);

        res.json({
            ok: true,
            data: result.rows[0]
        });

    } catch (error) {

        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});
/* =========================
   EXPORTAR REPORTE EXCEL
========================= */

app.get('/api/reporte', async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT *
            FROM citas
            ORDER BY fecha ASC, hora ASC
        `);

        const citas = result.rows.map(cita => ({
            ID: cita.id,
            Nombre: cita.nombre,
            Telefono: cita.telefono,
            Email: cita.email || '',
            Servicio: cita.servicio,
            Barbero: cita.medico,
            Fecha: cita.fecha,
            Hora: cita.hora
        }));

        const worksheet = XLSX.utils.json_to_sheet(citas);

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            'Citas'
        );

        const buffer = XLSX.write(workbook, {
            type: 'buffer',
            bookType: 'xlsx'
        });

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=\"reporte-citas.xlsx\"'
        );

        res.send(buffer);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});
/* =========================
   SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});