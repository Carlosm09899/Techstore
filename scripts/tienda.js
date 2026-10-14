const EMAILJS_CONFIG = {
    publicKey: 'iBPIQKMXDfhhBIO5o',
    serviceId: 'service_d2aacv3',
    templateId: 'template_k80j5ul'
};

emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });

const cuentaUsuario = document.getElementById('cuentaUsuario');
let sesionUsuario = null;
let equiposUsuario = [];
let productosCatalogo = [];
let productoCompatibilidadActual = null;
let resultadoCompatibilidadActual = null;
let carrito = [];

function mostrarUsuario(user) {
    sesionUsuario = user;
    cuentaUsuario.innerHTML = `<i class="bi bi-person-check me-1"></i>${escaparHTML(user.name)}`;
    cuentaUsuario.removeAttribute('data-bs-target');
    cuentaUsuario.setAttribute('data-bs-toggle', 'dropdown');
    cuentaUsuario.title = `Cuenta de ${user.name}`;
    cargarCarrito();
    actualizarIndicadorCarrito();
}

function mostrarCuentaInicial() {
    sesionUsuario = null;
    equiposUsuario = [];
    carrito = [];
    cuentaUsuario.innerHTML = '<i class="bi bi-person"></i>';
    cuentaUsuario.setAttribute('data-bs-toggle', 'modal');
    cuentaUsuario.setAttribute('data-bs-target', '#modalAuth');
    cuentaUsuario.title = 'Mi Cuenta';
    actualizarIndicadorCarrito();
    renderizarCarrito();
}

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[caracter]));
}

function solicitarInicioSesion(mensaje) {
    const msgLogin = document.getElementById('msgLogin');
    msgLogin.textContent = mensaje;
    msgLogin.className = 'mt-3 small text-center text-warning fw-medium';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalAuth')).show();
}

function formatoFecha(fecha) {
    return new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(fecha));
}

function claseEstadoOrden(estado) {
    const clases = {
        'Pendiente de pago': 'bg-warning text-dark',
        Pagada: 'bg-success',
        'En preparación': 'bg-info text-dark',
        Enviada: 'bg-primary',
        Entregada: 'bg-success',
        Cancelada: 'bg-danger'
    };
    return clases[estado] || 'bg-secondary';
}

function mostrarCompras(orders) {
    const lista = document.getElementById('listaCompras');
    lista.innerHTML = '';
    if (!orders.length) {
        lista.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-receipt-cutoff fs-1 d-block mb-3"></i>
                Aún no tienes compras registradas.
            </div>
        `;
        return;
    }

    orders.forEach((order) => {
        const numeroOrden = String(order._id).slice(-8).toUpperCase();
        const items = order.items.map((item) => `
            <div class="border-top pt-3 mt-3">
                <div class="d-flex justify-content-between gap-3">
                    <div>
                        <div class="fw-bold">${escaparHTML(item.nombre)}</div>
                        <div class="small text-muted">Cantidad: ${item.cantidad}</div>
                        <div class="small text-muted">Equipo: ${escaparHTML(item.equipoNombre)}</div>
                        <div class="small text-muted">Compatibilidad: ${escaparHTML(item.compatibilidad)}</div>
                    </div>
                    <div class="text-end fw-bold">$${Number(item.subtotal).toLocaleString()} MXN</div>
                </div>
            </div>
        `).join('');

        lista.insertAdjacentHTML('beforeend', `
            <div class="card border-0 shadow-sm rounded-4 mb-3">
                <div class="card-body p-4">
                    <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
                        <div>
                            <div class="small text-muted">Orden #${numeroOrden}</div>
                            <h5 class="fw-bold mb-1">Compra del ${formatoFecha(order.createdAt)}</h5>
                            <div class="small text-muted">Envío a: ${escaparHTML(order.envio.ciudad)}, ${escaparHTML(order.envio.estado)}</div>
                        </div>
                        <span class="badge ${claseEstadoOrden(order.estado)} rounded-pill px-3 py-2">${escaparHTML(order.estado)}</span>
                    </div>
                    <div class="mt-3">${items}</div>
                    <div class="border-top mt-3 pt-3 d-flex justify-content-end">
                        <span class="fw-bold">Total: $${Number(order.total).toLocaleString()} MXN</span>
                    </div>
                </div>
            </div>
        `);
    });
}

async function cargarCompras() {
    const lista = document.getElementById('listaCompras');
    lista.innerHTML = '<p class="text-muted text-center mb-0">Cargando compras...</p>';
    try {
        const respuesta = await fetch('/api/orders', { credentials: 'include' });
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.message || 'No se pudieron cargar tus compras');
        mostrarCompras(data.orders || []);
    } catch (error) {
        lista.innerHTML = `<p class="text-danger text-center mb-0">${escaparHTML(error.message)}</p>`;
    }
}

let direccionesUsuario = [];

function mostrarDirecciones(direcciones) {
    const lista = document.getElementById('listaDirecciones');
    lista.innerHTML = '';
    if (!direcciones.length) {
        lista.innerHTML = '<p class="text-muted text-center mb-0">Aún no tienes direcciones guardadas.</p>';
        return;
    }
    direcciones.forEach((direccion) => {
        lista.insertAdjacentHTML('beforeend', `
            <div class="col-md-6">
                <div class="card h-100 border-0 bg-light rounded-4">
                    <div class="card-body">
                        <div class="d-flex justify-content-between gap-2">
                            <div>
                                <span class="badge bg-primary rounded-pill">${escaparHTML(direccion.alias)}</span>
                                <h6 class="fw-bold mt-2 mb-1">${escaparHTML(direccion.nombre)}</h6>
                            </div>
                            <div class="d-flex gap-1">
                                <button type="button" class="btn btn-sm btn-outline-primary rounded-circle editar-direccion" data-id="${escaparHTML(direccion._id)}" aria-label="Editar dirección"><i class="bi bi-pencil"></i></button>
                                <button type="button" class="btn btn-sm btn-outline-danger rounded-circle eliminar-direccion" data-id="${escaparHTML(direccion._id)}" aria-label="Eliminar dirección"><i class="bi bi-trash"></i></button>
                            </div>
                        </div>
                        <div class="small text-muted mt-2">${escaparHTML(direccion.direccion)}<br>${escaparHTML(direccion.ciudad)}, ${escaparHTML(direccion.estado)}<br>CP ${escaparHTML(direccion.codigoPostal)} · ${escaparHTML(direccion.telefono)}</div>
                    </div>
                </div>
            </div>
        `);
    });
    lista.querySelectorAll('.editar-direccion').forEach((button) => {
        button.addEventListener('click', () => editarDireccion(button.dataset.id));
    });
    lista.querySelectorAll('.eliminar-direccion').forEach((button) => {
        button.addEventListener('click', () => eliminarDireccion(button.dataset.id));
    });
}

async function cargarDirecciones() {
    const lista = document.getElementById('listaDirecciones');
    lista.innerHTML = '<p class="text-muted text-center mb-0">Cargando direcciones...</p>';
    try {
        const respuesta = await fetch('/api/auth/direcciones', { credentials: 'include' });
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.message || 'No se pudieron cargar las direcciones');
        direccionesUsuario = data.direcciones || [];
        mostrarDirecciones(direccionesUsuario);
    } catch (error) {
        lista.innerHTML = `<p class="text-danger text-center mb-0">${escaparHTML(error.message)}</p>`;
    }
}

function abrirFormularioDireccion(direccion) {
    const form = document.getElementById('formDireccion');
    form.reset();
    form.removeAttribute('data-id');
    document.getElementById('tituloDireccion').innerHTML = '<i class="bi bi-plus-circle me-2"></i>Agregar dirección';
    if (direccion) {
        const valores = {
            direccionAlias: direccion.alias,
            direccionNombre: direccion.nombre,
            direccionTelefono: direccion.telefono,
            direccionCalle: direccion.direccion,
            direccionCiudad: direccion.ciudad,
            direccionEstado: direccion.estado,
            direccionCodigoPostal: direccion.codigoPostal
        };
        Object.entries(valores).forEach(([id, value]) => { document.getElementById(id).value = value; });
        form.dataset.id = direccion._id;
        document.getElementById('tituloDireccion').innerHTML = '<i class="bi bi-pencil me-2"></i>Editar dirección';
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNuevaDireccion')).show();
}

function editarDireccion(id) {
    const direccion = direccionesUsuario.find((item) => String(item._id) === String(id));
    if (direccion) {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalDirecciones')).hide();
        abrirFormularioDireccion(direccion);
    }
}

async function eliminarDireccion(id) {
    if (!window.confirm('¿Quieres eliminar esta dirección?')) return;
    try {
        const respuesta = await fetch(`/api/auth/direcciones/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.message || 'No se pudo eliminar la dirección');
        cargarDirecciones();
    } catch (error) {
        document.getElementById('listaDirecciones').insertAdjacentHTML('beforeend', `<p class="text-danger small text-center">${escaparHTML(error.message)}</p>`);
    }
}

document.getElementById('misDirecciones').addEventListener('click', () => {
    if (!sesionUsuario) {
        solicitarInicioSesion('Primero inicia sesión para administrar tus direcciones.');
        return;
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalDirecciones')).show();
    cargarDirecciones();
});
document.getElementById('nuevaDireccion').addEventListener('click', () => abrirFormularioDireccion());

document.getElementById('formDireccion').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const value = (id) => document.getElementById(id).value.trim();
    const datos = {
        alias: value('direccionAlias'),
        nombre: value('direccionNombre'),
        telefono: value('direccionTelefono'),
        direccion: value('direccionCalle'),
        ciudad: value('direccionCiudad'),
        estado: value('direccionEstado'),
        codigoPostal: value('direccionCodigoPostal')
    };
    const id = form.dataset.id;
    const mensaje = document.getElementById('msgDireccion');
    try {
        const respuesta = await fetch(id ? `/api/auth/direcciones/${encodeURIComponent(id)}` : '/api/auth/direcciones', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(datos)
        });
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.message || 'No se pudo guardar la dirección');
        mensaje.textContent = data.message;
        mensaje.className = 'small text-center text-success fw-medium mt-3';
        form.reset();
        form.removeAttribute('data-id');
        cargarDirecciones();
        setTimeout(() => {
            bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNuevaDireccion')).hide();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('modalDirecciones')).show();
        }, 500);
    } catch (error) {
        mensaje.textContent = error.message;
        mensaje.className = 'small text-center text-danger fw-medium mt-3';
    }
});

function obtenerClaveCarrito() {
    return sesionUsuario?.email ? `carrito:${sesionUsuario.email}` : null;
}

function guardarCarrito() {
    const clave = obtenerClaveCarrito();
    if (!clave) return;
    localStorage.setItem(clave, JSON.stringify(carrito));
}

function cargarCarrito() {
    const clave = obtenerClaveCarrito();
    if (!clave) {
        carrito = [];
        return;
    }
    try {
        const data = localStorage.getItem(clave);
        carrito = data ? JSON.parse(data) : [];
    } catch (error) {
        carrito = [];
    }
}

function actualizarIndicadorCarrito() {
    const contador = document.getElementById('carritoCantidad');
    const total = carrito.reduce((suma, item) => suma + item.cantidad, 0);
    contador.textContent = total;
    contador.classList.toggle('d-none', total === 0);
}

function renderizarCarrito() {
    const lista = document.getElementById('listaCarrito');
    const vacio = document.getElementById('carritoVacio');
    const totalElemento = document.getElementById('carritoTotal');
    const btnVaciar = document.getElementById('btnVaciarCarrito');
    const btnCheckout = document.getElementById('btnCheckout');
    const mensajeCheckout = document.getElementById('mensajeCheckout');

    lista.innerHTML = '';
    vacio.classList.toggle('d-none', carrito.length > 0);
    btnVaciar.disabled = carrito.length === 0;
    btnCheckout.disabled = true;
    mensajeCheckout.textContent = carrito.length ? 'Validando compatibilidad...' : '';
    mensajeCheckout.className = 'small text-muted';

    if (carrito.length === 0) {
        totalElemento.textContent = 'Total: $0 MXN';
        return;
    }

    let total = 0;
    carrito.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        lista.insertAdjacentHTML('beforeend', `
            <div class="border rounded-4 p-3 mb-3">
                <div class="d-flex justify-content-between align-items-start gap-3">
                    <div>
                        <h6 class="fw-bold mb-1">${escaparHTML(item.nombre)}</h6>
                        <p class="small text-muted mb-1">Equipo: ${escaparHTML(item.equipoNombre)}</p>
                        <p class="small text-muted mb-1">Compatibilidad: ${escaparHTML(item.detalleCompatibilidad)}</p>
                        <p class="small mb-0"><strong>Cantidad:</strong> ${item.cantidad}</p>
                    </div>
                    <div class="text-end">
                        <p class="fw-bold mb-2">$${subtotal.toLocaleString()} MXN</p>
                        <button type="button" class="btn btn-sm btn-outline-danger rounded-pill eliminar-item-carrito" data-index="${index}">
                            Eliminar
                        </button>
                    </div>
                </div>
            </div>
        `);
    });

    totalElemento.textContent = `Total: $${total.toLocaleString()} MXN`;
    lista.querySelectorAll('.eliminar-item-carrito').forEach((boton) => {
        boton.addEventListener('click', () => {
            carrito.splice(Number(boton.dataset.index), 1);
            guardarCarrito();
            actualizarIndicadorCarrito();
            renderizarCarrito();
        });
    });
    validarCarritoFinal();
}

function prepararCheckout() {
    const resumen = document.getElementById('resumenCheckout');
    const total = carrito.reduce((suma, item) => suma + (item.precio * item.cantidad), 0);
    resumen.innerHTML = carrito.map((item) => `
        <div class="d-flex justify-content-between small mb-2">
            <span>${escaparHTML(item.nombre)} x${item.cantidad}<br><span class="text-muted">Equipo: ${escaparHTML(item.equipoNombre)}</span></span>
            <strong>$${(item.precio * item.cantidad).toLocaleString()} MXN</strong>
        </div>
    `).join('');
    document.getElementById('checkoutTotal').textContent = `Total: $${total.toLocaleString()} MXN`;
    document.getElementById('msgCheckout').textContent = '';
    document.getElementById('msgCheckout').className = 'small fw-medium mt-3';
    const selector = document.getElementById('direccionGuardada');
    selector.innerHTML = '<option value="">Capturar una nueva dirección</option>';
    direccionesUsuario.forEach((direccion) => {
        selector.insertAdjacentHTML('beforeend', `<option value="${escaparHTML(direccion._id)}">${escaparHTML(direccion.alias)} - ${escaparHTML(direccion.ciudad)}, ${escaparHTML(direccion.estado)}</option>`);
    });
}

function llenarDatosDireccion(direccion) {
    if (!direccion) return;
    const datos = {
        envioNombre: direccion.nombre,
        envioTelefono: direccion.telefono,
        envioDireccion: direccion.direccion,
        envioCiudad: direccion.ciudad,
        envioEstado: direccion.estado,
        envioCodigoPostal: direccion.codigoPostal
    };
    Object.entries(datos).forEach(([id, value]) => { document.getElementById(id).value = value; });
}

async function validarCarritoFinal() {
    const btnCheckout = document.getElementById('btnCheckout');
    const mensajeCheckout = document.getElementById('mensajeCheckout');
    if (!sesionUsuario || !carrito.length) {
        btnCheckout.disabled = true;
        return false;
    }

    try {
        const [respuestaEquipos, respuestaProductos] = await Promise.all([
            fetch('/api/auth/equipos', { credentials: 'include' }),
            fetch('/api/productos')
        ]);
        const equiposData = await respuestaEquipos.json();
        const productos = await respuestaProductos.json();
        if (!respuestaEquipos.ok || !respuestaProductos.ok) {
            throw new Error('No se pudo confirmar la compatibilidad del carrito');
        }

        equiposUsuario = equiposData.equipos || [];
        const problemas = [];
        carrito.forEach((item) => {
            const producto = productos.find((elemento) => String(elemento._id) === String(item.productoId));
            const equipo = equiposUsuario.find((elemento) => String(elemento._id) === String(item.equipoId));
            if (!producto || !equipo) {
                problemas.push(`${item.nombre}: producto o equipo ya no disponible`);
                return;
            }
            if (Number(item.precio) !== Number(producto.precio)) {
                problemas.push(`${item.nombre}: el precio cambió, actualiza el carrito`);
                return;
            }
            if (!Number.isFinite(producto.stock) || producto.stock < item.cantidad) {
                problemas.push(`${item.nombre}: stock insuficiente`);
                return;
            }

            const resultado = validarCompatibilidad(producto, equipo);
            if (resultado.estado !== 'compatible') {
                problemas.push(`${item.nombre}: ${resultado.mensaje}`);
            }
        });

        if (problemas.length) {
            btnCheckout.disabled = true;
            mensajeCheckout.textContent = `Compra bloqueada: ${problemas.join(' ')}`;
            mensajeCheckout.className = 'small text-danger';
            return false;
        }

        btnCheckout.disabled = false;
        mensajeCheckout.textContent = 'Todos los productos son compatibles con sus equipos.';
        mensajeCheckout.className = 'small text-success';
        return true;
    } catch (error) {
        btnCheckout.disabled = true;
        mensajeCheckout.textContent = error.message;
        mensajeCheckout.className = 'small text-danger';
        return false;
    }
}

function obtenerTiposAlmacenamiento(tipo) {
    const mapa = {
        'SATA 2.5"': ['SATA_25'],
        'SATA M.2': ['SATA_M2'],
        'NVMe M.2': ['NVME_M2'],
        'SATA 2.5" y NVMe M.2': ['SATA_25', 'NVME_M2']
    };
    return mapa[tipo] || [];
}

function validarCompatibilidad(producto, equipo) {
    const reglas = producto.compatibilidad || {};
    if (reglas.tipoComponente === 'RAM') {
        const ramTipos = Array.isArray(reglas.ramTipos) ? reglas.ramTipos : [];
        if (!ramTipos.length) {
            return { estado: 'incompleta', mensaje: 'Este producto no tiene definido el tipo de RAM requerido.' };
        }
        return ramTipos.includes(equipo.ramTipo)
            ? { estado: 'compatible', mensaje: `Compatible: tu equipo usa ${equipo.ramTipo} y el producto acepta ${ramTipos.join(', ')}.` }
            : { estado: 'no-compatible', mensaje: `No compatible: tu equipo usa ${equipo.ramTipo} y el producto requiere ${ramTipos.join(', ')}.` };
    }

    if (reglas.tipoComponente === 'ALMACENAMIENTO') {
        const almacenamientoTipos = Array.isArray(reglas.almacenamientoTipos) ? reglas.almacenamientoTipos : [];
        if (!almacenamientoTipos.length) {
            return { estado: 'incompleta', mensaje: 'Este producto no tiene definido el tipo de almacenamiento requerido.' };
        }
        const tiposEquipo = obtenerTiposAlmacenamiento(equipo.almacenamientoTipo);
        const compatible = almacenamientoTipos.some((tipo) => tiposEquipo.includes(tipo));
        return compatible
            ? { estado: 'compatible', mensaje: `Compatible: tu equipo soporta ${equipo.almacenamientoTipo}.` }
            : { estado: 'no-compatible', mensaje: `No compatible: tu equipo soporta ${equipo.almacenamientoTipo}, pero el producto requiere ${almacenamientoTipos.join(', ')}.` };
    }

    return {
        estado: 'incompleta',
        mensaje: 'Aún no hay reglas de compatibilidad para este tipo de producto.'
    };
}

function badgeCompatibilidad(reglas) {
    if (reglas.tipoComponente === 'RAM') return `<span class="badge bg-info-subtle text-info-emphasis">RAM ${escaparHTML((reglas.ramTipos || []).join(', ') || 'sin especificar')}</span>`;
    if (reglas.tipoComponente === 'ALMACENAMIENTO') return `<span class="badge bg-warning-subtle text-warning-emphasis">Almacenamiento ${escaparHTML((reglas.almacenamientoTipos || []).join(', ') || 'sin especificar')}</span>`;
    return '<span class="badge bg-secondary-subtle text-secondary-emphasis">Compatibilidad pendiente</span>';
}

function mostrarEquipos(equipos) {
    const lista = document.getElementById('listaEquipos');
    const sinEquipos = document.getElementById('sinEquipos');

    lista.innerHTML = '';
    sinEquipos.classList.toggle('d-none', equipos.length > 0);
    if (equipos.length === 0) return;

    equipos.forEach((equipo) => {
        const detallesPc = equipo.tipo === 'PC' && equipo.procesador
            ? `<div><strong>Procesador:</strong> ${escaparHTML(equipo.procesador)}</div>`
            : '';
        lista.insertAdjacentHTML('beforeend', `
            <div class="col-md-6">
                <div class="card h-100 border-0 bg-light rounded-4">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start gap-2">
                            <div>
                                <span class="badge ${equipo.tipo === 'PC' ? 'bg-dark' : 'bg-primary'} rounded-pill">${escaparHTML(equipo.tipo)}</span>
                                <h5 class="fw-bold mt-2 mb-1">${escaparHTML(equipo.nombre)}</h5>
                                <p class="text-muted small mb-3">${escaparHTML(equipo.marca)} ${escaparHTML(equipo.modelo)}</p>
                            </div>
                            <div class="d-flex gap-1">
                                <button type="button" class="btn btn-sm btn-outline-primary rounded-circle editar-equipo" data-equipo-id="${escaparHTML(equipo._id)}" title="Editar equipo" aria-label="Editar ${escaparHTML(equipo.nombre)}">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-danger rounded-circle eliminar-equipo" data-equipo-id="${escaparHTML(equipo._id)}" title="Eliminar equipo" aria-label="Eliminar ${escaparHTML(equipo.nombre)}">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                        <div class="small text-muted">
                            <div><strong>RAM:</strong> ${escaparHTML(equipo.ramTipo)}${equipo.ramCapacidad ? `, ${escaparHTML(equipo.ramCapacidad)} GB` : ''}</div>
                            <div><strong>Almacenamiento:</strong> ${escaparHTML(equipo.almacenamientoTipo)}</div>
                            ${detallesPc}
                        </div>
                    </div>
                </div>
            </div>
        `);
    });

    lista.querySelectorAll('.eliminar-equipo').forEach((boton) => {
        boton.addEventListener('click', () => eliminarEquipo(boton.dataset.equipoId));
    });
    lista.querySelectorAll('.editar-equipo').forEach((boton) => {
        boton.addEventListener('click', () => editarEquipo(boton.dataset.equipoId));
    });
}

async function cargarEquipos() {
    const lista = document.getElementById('listaEquipos');
    lista.innerHTML = '<p class="text-muted text-center mb-0">Cargando equipos...</p>';
    document.getElementById('sinEquipos').classList.add('d-none');

    try {
        const respuesta = await fetch('/api/auth/equipos', { credentials: 'include' });
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.message || 'No se pudieron cargar los equipos');
        equiposUsuario = data.equipos || [];
        mostrarEquipos(data.equipos);
    } catch (error) {
        equiposUsuario = [];
        lista.innerHTML = `<p class="text-danger text-center mb-0">${escaparHTML(error.message)}</p>`;
    }
}

async function eliminarEquipo(equipoId) {
    if (!window.confirm('¿Quieres eliminar este equipo de tu cuenta?')) return;

    try {
        const respuesta = await fetch(`/api/auth/equipos/${encodeURIComponent(equipoId)}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.message || 'No se pudo eliminar el equipo');
        cargarEquipos();
    } catch (error) {
        document.getElementById('listaEquipos').insertAdjacentHTML(
            'beforeend',
            `<p class="text-danger small text-center mt-2">${escaparHTML(error.message)}</p>`
        );
    }
}

function abrirModalNuevoEquipo() {
    document.getElementById('formEquipo').removeAttribute('data-equipo-id');
    document.querySelector('#modalNuevoEquipo .modal-title').innerHTML = '<i class="bi bi-plus-circle me-2"></i>Agregar equipo';
    document.querySelector('#formEquipo button[type="submit"]').innerHTML = '<i class="bi bi-save me-2"></i>Guardar y agregar equipo';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNuevoEquipo')).show();
}

function editarEquipo(equipoId) {
    const equipo = equiposUsuario.find((item) => String(item._id) === String(equipoId));
    if (!equipo) return;

    const valores = {
        equipoNombre: equipo.nombre,
        equipoTipo: equipo.tipo,
        equipoMarca: equipo.marca,
        equipoModelo: equipo.modelo,
        equipoSistema: equipo.sistema || '',
        equipoRamTipo: equipo.ramTipo,
        equipoRamCapacidad: equipo.ramCapacidad || '',
        equipoRamRanuras: equipo.ramRanuras || '',
        equipoAlmacenamientoTipo: equipo.almacenamientoTipo,
        equipoAlmacenamientoCapacidad: equipo.almacenamientoCapacidad || '',
        equipoProcesador: equipo.procesador || '',
        equipoSocket: equipo.socket || '',
        equipoGrafica: equipo.tarjetaGrafica || '',
        equipoFuente: equipo.fuentePotencia || ''
    };
    Object.entries(valores).forEach(([id, value]) => {
        document.getElementById(id).value = value;
    });
    document.getElementById('formEquipo').dataset.equipoId = equipoId;
    document.querySelector('#modalNuevoEquipo .modal-title').innerHTML = '<i class="bi bi-pencil me-2"></i>Editar equipo';
    document.querySelector('#formEquipo button[type="submit"]').innerHTML = '<i class="bi bi-save me-2"></i>Guardar cambios';
    document.getElementById('camposPc').classList.toggle('d-none', equipo.tipo !== 'PC');
    document.getElementById('notaLaptop').classList.toggle('d-none', equipo.tipo !== 'Laptop');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEquipos')).hide();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNuevoEquipo')).show();
}

document.getElementById('misEquipos').addEventListener('click', () => {
    if (!sesionUsuario) {
        solicitarInicioSesion('Primero inicia sesión para administrar tus equipos.');
        return;
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEquipos')).show();
    cargarEquipos();
});

document.getElementById('misCompras').addEventListener('click', () => {
    if (!sesionUsuario) {
        solicitarInicioSesion('Primero inicia sesión para consultar tus compras.');
        return;
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCompras')).show();
    cargarCompras();
});

document.getElementById('agregarEquipo').addEventListener('click', () => {
    if (!sesionUsuario) {
        solicitarInicioSesion('Primero inicia sesión para registrar un equipo.');
        return;
    }
    abrirModalNuevoEquipo();
});
document.getElementById('nuevoEquipoDesdeLista').addEventListener('click', () => {
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEquipos')).hide();
    abrirModalNuevoEquipo();
});

document.getElementById('equipoTipo').addEventListener('change', (event) => {
    const esPc = event.target.value === 'PC';
    document.getElementById('camposPc').classList.toggle('d-none', !esPc);
    document.getElementById('notaLaptop').classList.toggle('d-none', esPc || !event.target.value);
});

document.getElementById('formEquipo').addEventListener('submit', async (event) => {
    event.preventDefault();
    const tipo = document.getElementById('equipoTipo').value;
    const equipoId = event.currentTarget.dataset.equipoId;
    const mensaje = document.getElementById('msgEquipo');
    const valor = (id) => document.getElementById(id).value.trim();
    const numero = (id) => document.getElementById(id).value ? Number(document.getElementById(id).value) : undefined;
    const datos = {
        nombre: valor('equipoNombre'),
        tipo,
        marca: valor('equipoMarca'),
        modelo: valor('equipoModelo'),
        sistema: valor('equipoSistema'),
        ramTipo: valor('equipoRamTipo'),
        ramCapacidad: numero('equipoRamCapacidad'),
        ramRanuras: numero('equipoRamRanuras'),
        almacenamientoTipo: valor('equipoAlmacenamientoTipo'),
        almacenamientoCapacidad: numero('equipoAlmacenamientoCapacidad')
    };

    if (tipo === 'PC') {
        datos.procesador = valor('equipoProcesador');
        datos.socket = valor('equipoSocket');
        datos.tarjetaGrafica = valor('equipoGrafica');
        datos.fuentePotencia = numero('equipoFuente');
    }

    mensaje.textContent = 'Guardando equipo...';
    mensaje.className = 'small text-center text-info fw-medium mt-3';

    try {
        const respuesta = await fetch(equipoId
            ? `/api/auth/equipos/${encodeURIComponent(equipoId)}`
            : '/api/auth/equipos', {
            method: equipoId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(datos)
        });
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.message || 'No se pudo guardar el equipo');

        mensaje.textContent = data.message;
        mensaje.className = 'small text-center text-success fw-medium mt-3';
        document.getElementById('formEquipo').reset();
        document.getElementById('formEquipo').removeAttribute('data-equipo-id');
        document.getElementById('camposPc').classList.add('d-none');
        document.getElementById('notaLaptop').classList.add('d-none');
        document.querySelector('#modalNuevoEquipo .modal-title').innerHTML = '<i class="bi bi-plus-circle me-2"></i>Agregar equipo';
        document.querySelector('#formEquipo button[type="submit"]').innerHTML = '<i class="bi bi-save me-2"></i>Guardar y agregar equipo';
        cargarEquipos();
        setTimeout(() => {
            bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNuevoEquipo')).hide();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEquipos')).show();
        }, 500);
    } catch (error) {
        mensaje.textContent = error.message;
        mensaje.className = 'small text-center text-danger fw-medium mt-3';
    }
});

function llenarEquiposEnSelector() {
    const selector = document.getElementById('equipoCompatibilidad');
    selector.innerHTML = '<option value="">Selecciona un equipo</option>';
    equiposUsuario.forEach((equipo) => {
        selector.insertAdjacentHTML(
            'beforeend',
            `<option value="${escaparHTML(equipo._id)}">${escaparHTML(equipo.nombre)} (${escaparHTML(equipo.tipo)} - ${escaparHTML(equipo.ramTipo)} / ${escaparHTML(equipo.almacenamientoTipo)})</option>`
        );
    });
}

function mostrarResultadoCompatibilidad(resultado) {
    const contenedor = document.getElementById('resultadoCompatibilidad');
    const clases = {
        compatible: 'alert alert-success small mb-3',
        'no-compatible': 'alert alert-danger small mb-3',
        incompleta: 'alert alert-warning small mb-3'
    };
    contenedor.className = clases[resultado.estado] || 'alert alert-light small mb-3';
    contenedor.textContent = resultado.mensaje;
    document.getElementById('btnAgregarCarrito').disabled = resultado.estado !== 'compatible';
}

async function abrirModalCompatibilidad(productoId) {
    if (!sesionUsuario) {
        solicitarInicioSesion('Inicia sesión para validar compatibilidad y agregar al carrito.');
        return;
    }

    if (!equiposUsuario.length) {
        await cargarEquipos();
    }
    if (!equiposUsuario.length) {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEquipos')).show();
        document.getElementById('listaEquipos').insertAdjacentHTML(
            'beforeend',
            '<p class="text-warning text-center small mt-3">Registra al menos un equipo para validar compatibilidad.</p>'
        );
        return;
    }

    productoCompatibilidadActual = productosCatalogo.find((producto) => String(producto._id) === productoId) || null;
    resultadoCompatibilidadActual = null;
    if (!productoCompatibilidadActual) return;

    document.getElementById('productoCompatibilidadNombre').textContent = productoCompatibilidadActual.nombre;
    document.getElementById('productoCompatibilidadPrecio').textContent = `$${Number(productoCompatibilidadActual.precio || 0).toLocaleString()} MXN`;
    document.getElementById('compatibilidadReglas').innerHTML = badgeCompatibilidad(productoCompatibilidadActual.compatibilidad || {});
    document.getElementById('msgCompatibilidad').textContent = '';
    document.getElementById('equipoCompatibilidad').value = '';
    document.getElementById('btnAgregarCarrito').disabled = true;
    document.getElementById('resultadoCompatibilidad').className = 'alert alert-light small mb-3';
    document.getElementById('resultadoCompatibilidad').textContent = 'Selecciona un equipo para validar compatibilidad.';
    llenarEquiposEnSelector();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCompatibilidad')).show();
}

function evaluarCompatibilidadSeleccionada() {
    const equipoId = document.getElementById('equipoCompatibilidad').value;
    if (!equipoId || !productoCompatibilidadActual) {
        document.getElementById('btnAgregarCarrito').disabled = true;
        return;
    }

    const equipo = equiposUsuario.find((item) => String(item._id) === equipoId);
    if (!equipo) return;
    resultadoCompatibilidadActual = {
        ...validarCompatibilidad(productoCompatibilidadActual, equipo),
        equipoId: String(equipo._id),
        equipoNombre: equipo.nombre
    };
    mostrarResultadoCompatibilidad(resultadoCompatibilidadActual);
}

document.getElementById('equipoCompatibilidad').addEventListener('change', evaluarCompatibilidadSeleccionada);

document.getElementById('btnAgregarCarrito').addEventListener('click', () => {
    if (!productoCompatibilidadActual || !resultadoCompatibilidadActual || resultadoCompatibilidadActual.estado !== 'compatible') {
        return;
    }

    const existente = carrito.find((item) =>
        item.productoId === String(productoCompatibilidadActual._id)
        && item.equipoId === resultadoCompatibilidadActual.equipoId
    );

    if (existente) {
        existente.cantidad += 1;
    } else {
        carrito.push({
            productoId: String(productoCompatibilidadActual._id),
            nombre: productoCompatibilidadActual.nombre,
            precio: Number(productoCompatibilidadActual.precio || 0),
            cantidad: 1,
            equipoId: resultadoCompatibilidadActual.equipoId,
            equipoNombre: resultadoCompatibilidadActual.equipoNombre,
            detalleCompatibilidad: resultadoCompatibilidadActual.mensaje
        });
    }

    guardarCarrito();
    actualizarIndicadorCarrito();
    renderizarCarrito();
    const mensaje = document.getElementById('msgCompatibilidad');
    mensaje.textContent = 'Producto agregado al carrito.';
    mensaje.className = 'small fw-medium text-success';
});

async function cargarSesion() {
    try {
        const respuesta = await fetch('/api/auth/me', { credentials: 'include' });
        if (respuesta.ok) {
            const data = await respuesta.json();
            mostrarUsuario(data.user);
        } else {
            mostrarCuentaInicial();
        }
    } catch (error) {
        console.error('No se pudo comprobar la sesión:', error);
        mostrarCuentaInicial();
    }
}

document.getElementById('cerrarSesion').addEventListener('click', async () => {
    await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
    });
    mostrarCuentaInicial();
});

// 1. Cargar productos desde MongoDB
async function cargarProductos(categoria = '') {
    try {
        const url = new URL('/api/productos', window.location.origin);
        if (categoria) {
            url.searchParams.set('categoria', categoria);
        }

        const respuesta = await fetch(url);
        const productos = await respuesta.json();
        productosCatalogo = productos;
        
        const contenedor = document.getElementById('contenedor-productos');
        contenedor.innerHTML = ''; 

        if (productos.length === 0) {
            contenedor.innerHTML = '<p class="text-center text-muted col-12">No hay productos en esta categoría.</p>';
            return;
        }

        productos.forEach((producto) => {
            const compatibilidad = producto.compatibilidad || {};
            const cardHTML = `
                <div class="col">
                    <div class="card h-100 border-0 shadow-sm rounded-4 text-center p-3">
                        <div class="text-end mb-2">
                            <span class="badge bg-success"><i class="bi bi-shield-check"></i> 0 Riesgo</span>
                        </div>
                        <div class="bg-secondary bg-opacity-10 rounded-3 p-4 mb-3 d-flex align-items-center justify-content-center" style="height: 180px;">
                            <i class="bi bi-pc-display-horizontal display-1 text-dark"></i>
                        </div>
                        <div class="card-body p-0 d-flex flex-column">
                            <h5 class="card-title fw-bold">${escaparHTML(producto.nombre)}</h5>
                            <p class="card-text text-muted small">${escaparHTML(producto.descripcion_corta || 'Sin descripción')}</p>
                            <p class="text-primary small mb-3"><i class="bi bi-tools"></i> Incluye manual y herramientas</p>
                            <div class="mb-2">${badgeCompatibilidad(compatibilidad)}</div>
                            <p class="fw-bold fs-5 mt-auto">$${Number(producto.precio || 0).toLocaleString()} MXN</p>
                            <button class="btn btn-dark rounded-pill w-100 mt-2 btn-validar-compatibilidad" data-producto-id="${escaparHTML(String(producto._id))}">Validar Compatibilidad</button>
                        </div>
                    </div>
                </div>
            `;
            contenedor.innerHTML += cardHTML;
        });

        contenedor.querySelectorAll('.btn-validar-compatibilidad').forEach((boton) => {
            boton.addEventListener('click', () => abrirModalCompatibilidad(boton.dataset.productoId));
        });
    } catch (error) {
        console.error("Error al conectar con el backend de productos:", error);
    }
}

document.querySelectorAll('.filtro-categoria').forEach((boton) => {
    boton.addEventListener('click', () => {
        document.querySelectorAll('.filtro-categoria').forEach((item) => item.classList.remove('active'));
        boton.classList.add('active');
        cargarProductos(boton.dataset.categoria);
    });
});

document.getElementById('btnVaciarCarrito').addEventListener('click', () => {
    if (!carrito.length) return;
    carrito = [];
    guardarCarrito();
    actualizarIndicadorCarrito();
    renderizarCarrito();
});

document.getElementById('btnCheckout').addEventListener('click', async () => {
    const carritoValido = await validarCarritoFinal();
    if (!carritoValido) return;
    await cargarDirecciones();
    prepararCheckout();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCarrito')).hide();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCheckout')).show();
});

document.getElementById('direccionGuardada').addEventListener('change', (event) => {
    const direccion = direccionesUsuario.find((item) => String(item._id) === event.target.value);
    if (direccion) llenarDatosDireccion(direccion);
    else document.getElementById('formCheckout').reset();
});

function generarCodigoPaynet(total) {
    const codigo = `PAYNET-${Date.now().toString().slice(-10)}-${Math.round(total).toString().padStart(6, '0')}`;
    const visual = document.getElementById('paynetBarcodeVisual');
    document.getElementById('paynetBarcodeValue').textContent = codigo;
    visual.replaceChildren();

    for (const caracter of codigo) {
        const barra = document.createElement('span');
        barra.style.width = `${caracter.charCodeAt(0) % 4 + 1}px`;
        barra.style.height = `${48 + caracter.charCodeAt(0) % 32}px`;
        barra.className = 'bg-dark d-inline-block';
        visual.appendChild(barra);
    }
}

function obtenerDatosEnvio() {
    const valor = (id) => document.getElementById(id).value.trim();
    return {
        nombre: valor('envioNombre'),
        telefono: valor('envioTelefono'),
        direccion: valor('envioDireccion'),
        ciudad: valor('envioCiudad'),
        estado: valor('envioEstado'),
        codigoPostal: valor('envioCodigoPostal')
    };
}

async function confirmarCompraPaynet() {
    const boton = document.getElementById('btnPagarPaynet');
    const mensaje = document.getElementById('msgCheckout');
    boton.disabled = true;
    mensaje.textContent = 'Validando inventario y compatibilidad...';
    mensaje.className = 'small text-center fw-medium mt-3 text-info';

    try {
        const respuesta = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                items: carrito,
                envio: obtenerDatosEnvio(),
                metodoPago: 'Paynet'
            })
        });
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.message || 'No se pudo confirmar la compra');

        mensaje.textContent = `${data.message}. Folio: ${data.orderId}`;
        mensaje.className = 'small text-center fw-medium mt-3 text-success';
        carrito = [];
        guardarCarrito();
        actualizarIndicadorCarrito();
        renderizarCarrito();
        generarCodigoPaynet(data.total);
        document.getElementById('formCheckout').reset();
        document.getElementById('metodoPago').value = 'Paynet';
    } catch (error) {
        mensaje.textContent = error.message;
        mensaje.className = 'small text-center fw-medium mt-3 text-danger';
    } finally {
        boton.disabled = false;
    }
}

document.getElementById('btnPagarPaynet').addEventListener('click', async () => {
    if (!document.getElementById('formCheckout').reportValidity()) return;
    await confirmarCompraPaynet();
});

document.getElementById('formCheckout').addEventListener('submit', async (event) => {
    event.preventDefault();
    const boton = document.getElementById('btnPagarStripe');
    const mensaje = document.getElementById('msgCheckout');

    // Cambiamos el estado visual del botón para indicar que está procesando
    boton.disabled = true;
    boton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Redirigiendo a pasarela...';
    mensaje.textContent = 'Conectando de forma segura con Stripe...';
    mensaje.className = 'small fw-medium mt-3 text-info';

    try {
        const respuesta = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ items: carrito })
        });
        
        const data = await respuesta.json();
        
        if (!respuesta.ok) throw new Error(data.error || 'No se pudo iniciar el pago seguro');

        // Redirección inmediata a la pantalla de Stripe
        if (data.url) {
            window.location.href = data.url; 
        }
    } catch (error) {
        mensaje.textContent = error.message;
        mensaje.className = 'small fw-medium mt-3 text-danger';
        // Restauramos el botón a su estado original si ocurre un error
        boton.disabled = false;
        boton.innerHTML = '<i class="bi bi-credit-card fs-5"></i> Pagar con Tarjeta (Stripe)';
    }
});


document.getElementById('modalCarrito').addEventListener('show.bs.modal', () => {
    if (!sesionUsuario) {
        solicitarInicioSesion('Inicia sesión para usar tu carrito personalizado.');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCarrito')).hide();
        return;
    }
    renderizarCarrito();
});

// 2. Manejo del Registro de Usuarios
document.getElementById('formRegistro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const msgDiv = document.getElementById('msgRegistro');

    msgDiv.textContent = "Creando tu cuenta...";
    msgDiv.className = "mt-3 small text-center text-info fw-medium";

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        msgDiv.textContent = data.message;
        msgDiv.className = res.ok ? "mt-3 small text-center text-success fw-medium" : "mt-3 small text-center text-danger fw-medium";
        if (res.ok) {
            document.getElementById('formRegistro').reset();
        }
    } catch (error) {
        msgDiv.textContent = "Error de conexión con el servidor";
        msgDiv.className = "mt-3 small text-center text-danger fw-medium";
    }
});

// 3. Manejo del Inicio de Sesión
document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const msgDiv = document.getElementById('msgLogin');

    msgDiv.textContent = "Verificando credenciales...";
    msgDiv.className = "mt-3 small text-center text-info fw-medium";

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        msgDiv.textContent = data.message;
        msgDiv.className = res.ok ? "mt-3 small text-center text-success fw-medium" : "mt-3 small text-center text-danger fw-medium";
        if (res.ok) {
            document.getElementById('formLogin').reset();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('modalAuth')).hide();
            mostrarUsuario(data.user);
        }
    } catch (error) {
        msgDiv.textContent = "Error de conexión con el servidor";
        msgDiv.className = "mt-3 small text-center text-danger fw-medium";
    }
});

// 4. Manejo del Formulario de Contacto
document.getElementById('formContacto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('contNombre').value;
    const emailUsuario = document.getElementById('contEmail').value;
    const mensaje = document.getElementById('contMensaje').value;
    const msgDiv = document.getElementById('msgContacto');

    msgDiv.textContent = "Enviando mensaje...";
    msgDiv.className = "mt-3 small text-center text-info fw-medium";

    try {
        await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
            from_name: nombre,
            reply_to: emailUsuario,
            message: mensaje
        });
        msgDiv.textContent = "Mensaje enviado correctamente";
        msgDiv.className = "mt-3 small text-center text-success fw-medium";
        document.getElementById('formContacto').reset();
    } catch (error) {
        msgDiv.textContent = "Error al enviar el mensaje";
        msgDiv.className = "mt-3 small text-center text-danger fw-medium";
    }
});

document.querySelectorAll('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => {
        const passwordInput = document.getElementById(button.dataset.togglePassword);
        const icon = button.querySelector('i');
        const isHidden = passwordInput.type === 'password';

        passwordInput.type = isHidden ? 'text' : 'password';
        icon.className = isHidden ? 'bi bi-eye-slash' : 'bi bi-eye';
        button.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
});

document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();
    cargarSesion();
});