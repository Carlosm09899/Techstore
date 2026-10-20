const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const productoSchema = new mongoose.Schema({
  nombre: String,
  categoria: String,
  precio: Number,
  stock: Number,
  descripcion_corta: String,
  imagen_url: String,
  tipo_producto: String,
  detalles_tecnicos: Object,
  compatibilidad: {
    tipoComponente: String,
    ramTipos: [String],
    almacenamientoTipos: [String],
    capacidadMinimaGB: Number,
    capacidadMaximaGB: Number
  },
  activo: Boolean
}, { collection: 'productos' });

const Producto = mongoose.model('ProductoSeed', productoSchema);

const productosIniciales = [
  // --- MEMORIAS RAM & COMPONENTES PC ---
  {
    nombre: 'Memoria RAM DDR4 8GB 3200MHz',
    categoria: 'Componentes PC',
    precio: 399,
    descripcion_corta: 'Módulo DDR4 de 8 GB para equipos compatibles con alta estabilidad.',
    tipo_producto: 'RAM',
    detalles_tecnicos: { capacidad: '8 GB', velocidad: '3200 MHz' },
    compatibilidad: { tipoComponente: 'RAM', ramTipos: ['DDR4'] }
  },
  {
    nombre: 'Memoria RAM DDR4 16GB 3200MHz',
    categoria: 'Componentes PC',
    precio: 699,
    descripcion_corta: 'Módulo DDR4 de 16 GB ideal para multitarea fluida y diseño digital.',
    tipo_producto: 'RAM',
    detalles_tecnicos: { capacidad: '16 GB', velocidad: '3200 MHz' },
    compatibilidad: { tipoComponente: 'RAM', ramTipos: ['DDR4'] }
  },
  {
    nombre: 'Memoria RAM DDR4 32GB (2x16GB) Kingston Fury 3200MHz',
    categoria: 'Componentes PC',
    precio: 1349,
    descripcion_corta: 'Kit Dual Channel de 32 GB optimizado para gaming competitivo y edición pesada.',
    tipo_producto: 'RAM',
    detalles_tecnicos: { capacidad: '32 GB (2x16GB)', velocidad: '3200 MHz', latencia: 'CL16' },
    compatibilidad: { tipoComponente: 'RAM', ramTipos: ['DDR4'] }
  },
  {
    nombre: 'Memoria RAM DDR5 16GB 5200MHz',
    categoria: 'Componentes PC',
    precio: 999,
    descripcion_corta: 'Módulo DDR5 de 16 GB para plataformas Intel Core 13/14va gen y AMD AM5.',
    tipo_producto: 'RAM',
    detalles_tecnicos: { capacidad: '16 GB', velocidad: '5200 MHz' },
    compatibilidad: { tipoComponente: 'RAM', ramTipos: ['DDR5'] }
  },
  {
    nombre: 'Memoria RAM DDR5 32GB 5600MHz Corsair Vengeance',
    categoria: 'Componentes PC',
    precio: 1899,
    descripcion_corta: 'Módulo DDR5 de 32 GB de altísima frecuencia con disipador de aluminio negro anodizado.',
    tipo_producto: 'RAM',
    detalles_tecnicos: { capacidad: '32 GB', velocidad: '5600 MHz', disipador: 'Aluminio anodizado' },
    compatibilidad: { tipoComponente: 'RAM', ramTipos: ['DDR5'] }
  },
  {
    nombre: 'Fuente de Poder 650W 80 Plus Bronze Certificada',
    categoria: 'Componentes PC',
    precio: 1249,
    descripcion_corta: 'Fuente de 650W con certificación 80 Plus Bronze, ventilador silencioso y cables mallados.',
    tipo_producto: 'FUENTE',
    detalles_tecnicos: { potencia: '650 Watts', certificacion: '80 Plus Bronze', protecciones: 'OVP, UVP, SCP, OPP' },
    compatibilidad: { tipoComponente: 'OTRO' }
  },

  // --- ALMACENAMIENTO (SSD / NVMe / HDD) ---
  {
    nombre: 'SSD NVMe M.2 500GB',
    categoria: 'Almacenamiento',
    precio: 849,
    descripcion_corta: 'Almacenamiento NVMe ultrarrápido de 500 GB con lectura de hasta 2400 MB/s.',
    tipo_producto: 'SSD',
    detalles_tecnicos: { capacidad: '500 GB', interfaz: 'NVMe M.2 PCIe Gen3' },
    compatibilidad: { tipoComponente: 'ALMACENAMIENTO', almacenamientoTipos: ['NVMe M.2'], capacidadMinimaGB: 500 }
  },
  {
    nombre: 'SSD NVMe M.2 1TB Kingston NV2 PCIe 4.0',
    categoria: 'Almacenamiento',
    precio: 1399,
    descripcion_corta: 'SSD NVMe Gen 4x4 de 1 TB con velocidad de transferencia de hasta 3500 MB/s.',
    tipo_producto: 'SSD',
    detalles_tecnicos: { capacidad: '1000 GB (1 TB)', interfaz: 'NVMe M.2 PCIe 4.0' },
    compatibilidad: { tipoComponente: 'ALMACENAMIENTO', almacenamientoTipos: ['NVMe M.2'], capacidadMinimaGB: 1000 }
  },
  {
    nombre: 'SSD SATA 2.5 480GB',
    categoria: 'Almacenamiento',
    precio: 699,
    descripcion_corta: 'SSD SATA de 480 GB para laptops y PC. Hasta 10 veces más rápido que un disco mecánico.',
    tipo_producto: 'SSD',
    detalles_tecnicos: { capacidad: '480 GB', interfaz: 'SATA 2.5"' },
    compatibilidad: { tipoComponente: 'ALMACENAMIENTO', almacenamientoTipos: ['SATA 2.5"'], capacidadMinimaGB: 480 }
  },
  {
    nombre: 'SSD SATA 2.5 1TB Crucial BX500',
    categoria: 'Almacenamiento',
    precio: 1199,
    descripcion_corta: 'SSD SATA 2.5" de 1 TB para almacenamiento rápido y arranque instantáneo del sistema operativo.',
    tipo_producto: 'SSD',
    detalles_tecnicos: { capacidad: '1000 GB (1 TB)', interfaz: 'SATA 2.5"' },
    compatibilidad: { tipoComponente: 'ALMACENAMIENTO', almacenamientoTipos: ['SATA 2.5"'], capacidadMinimaGB: 1000 }
  },
  {
    nombre: 'Disco duro SATA 2TB',
    categoria: 'Almacenamiento',
    precio: 1099,
    descripcion_corta: 'Disco duro mecánico SATA de 2 TB para almacenamiento masivo de archivos, fotos y juegos.',
    tipo_producto: 'HDD',
    detalles_tecnicos: { capacidad: '2000 GB (2 TB)', interfaz: 'SATA 2.5"' },
    compatibilidad: { tipoComponente: 'ALMACENAMIENTO', almacenamientoTipos: ['SATA 2.5"'], capacidadMinimaGB: 2000 }
  },

  // --- REPUESTOS LAPTOPS ---
  {
    nombre: 'Batería universal para laptop',
    categoria: 'Repuestos Laptops',
    precio: 899,
    descripcion_corta: 'Batería de reemplazo de ion de litio certificada para modelos portátiles compatibles.',
    tipo_producto: 'BATERIA',
    detalles_tecnicos: { garantia: '6 meses', celdas: '4 celdas' },
    compatibilidad: { tipoComponente: 'REPUESTO_LAPTOP' }
  },
  {
    nombre: 'Cargador Universal Laptop 65W USB-C PD',
    categoria: 'Repuestos Laptops',
    precio: 549,
    descripcion_corta: 'Adaptador de corriente universal con conector USB-C y carga rápida Power Delivery.',
    tipo_producto: 'CARGADOR',
    detalles_tecnicos: { potencia: '65W', protocolo: 'Power Delivery 3.0', cable: '1.8 metros' },
    compatibilidad: { tipoComponente: 'REPUESTO_LAPTOP' }
  },
  {
    nombre: 'Pantalla LED 15.6" Slim FHD 30 Pines 1080p IPS',
    categoria: 'Repuestos Laptops',
    precio: 1499,
    descripcion_corta: 'Panel de reemplazo IPS de alta definición 1080p con conector eDP de 30 pines sin marcos.',
    tipo_producto: 'PANTALLA',
    detalles_tecnicos: { tamano: '15.6 pulgadas', resolucion: '1920x1080 FHD', conector: '30 pines eDP' },
    compatibilidad: { tipoComponente: 'REPUESTO_LAPTOP' }
  },

  // --- MANTENIMIENTO PC & HERRAMIENTAS ---
  {
    nombre: 'Kit de limpieza para PC y laptop',
    categoria: 'Mantenimiento PC',
    precio: 249,
    descripcion_corta: 'Kit de mantenimiento preventivo con brocha anti-estática, aire manual y paño de microfibra.',
    tipo_producto: 'MANTENIMIENTO',
    detalles_tecnicos: { incluye: 'Brocha anti-estática, sopladora de aire y microfibra de alta densidad' },
    compatibilidad: { tipoComponente: 'OTRO' }
  },
  {
    nombre: 'Pasta Térmica Artic MX-4 4g de Alto Rendimiento',
    categoria: 'Mantenimiento PC',
    precio: 189,
    descripcion_corta: 'Compuesto térmico de micropartículas de carbono para disipación óptima en procesadores y GPU.',
    tipo_producto: 'MANTENIMIENTO',
    detalles_tecnicos: { peso: '4 gramos', conductividad: '8.5 W/(mK)', durabilidad: 'Hasta 8 años' },
    compatibilidad: { tipoComponente: 'OTRO' }
  },
  {
    nombre: 'Juego de Destornilladores de Precisión 64 en 1 con Pinzas',
    categoria: 'Mantenimiento PC',
    precio: 349,
    descripcion_corta: 'Set profesional con 64 puntas magnéticas para desarmar laptops, consolas, celulares y PC.',
    tipo_producto: 'MANTENIMIENTO',
    detalles_tecnicos: { piezas: '64 puntas imantadas, barra de extensión flexible y pinzas ESD' },
    compatibilidad: { tipoComponente: 'OTRO' }
  }
];

module.exports = { productosIniciales };

async function ejecutar() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no está configurada');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const stockMinimo = 10;
  const resultadoStock = await Producto.updateMany(
    { activo: true },
    { $max: { stock: stockMinimo } }
  );

  for (const producto of productosIniciales) {
    await Producto.updateOne(
      { nombre: producto.nombre },
      {
        $set: { ...producto, activo: true },
        $max: { stock: stockMinimo }
      },
      { upsert: true }
    );
  }

  console.log(`Stock actualizado en ${resultadoStock.modifiedCount} productos existentes.`);
  console.log(`${productosIniciales.length} productos de catálogo creados o actualizados.`);
}

if (require.main === module) {
  ejecutar()
    .catch((error) => {
      console.error('No se pudo actualizar el catálogo:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
