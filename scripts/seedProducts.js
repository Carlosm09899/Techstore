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
  {
    nombre: 'Memoria RAM DDR4 8GB 3200MHz',
    categoria: 'Componentes PC',
    precio: 399,
    descripcion_corta: 'Módulo DDR4 de 8 GB para equipos compatibles.',
    tipo_producto: 'RAM',
    detalles_tecnicos: { capacidad: '8 GB', velocidad: '3200 MHz' },
    compatibilidad: { tipoComponente: 'RAM', ramTipos: ['DDR4'] }
  },
  {
    nombre: 'Memoria RAM DDR4 16GB 3200MHz',
    categoria: 'Componentes PC',
    precio: 699,
    descripcion_corta: 'Módulo DDR4 de 16 GB para actualizar tu equipo.',
    tipo_producto: 'RAM',
    detalles_tecnicos: { capacidad: '16 GB', velocidad: '3200 MHz' },
    compatibilidad: { tipoComponente: 'RAM', ramTipos: ['DDR4'] }
  },
  {
    nombre: 'Memoria RAM DDR5 16GB 5200MHz',
    categoria: 'Componentes PC',
    precio: 999,
    descripcion_corta: 'Módulo DDR5 de 16 GB para equipos de nueva generación.',
    tipo_producto: 'RAM',
    detalles_tecnicos: { capacidad: '16 GB', velocidad: '5200 MHz' },
    compatibilidad: { tipoComponente: 'RAM', ramTipos: ['DDR5'] }
  },
  {
    nombre: 'SSD NVMe M.2 500GB',
    categoria: 'Almacenamiento',
    precio: 849,
    descripcion_corta: 'Almacenamiento NVMe rápido de 500 GB.',
    tipo_producto: 'SSD',
    detalles_tecnicos: { capacidad: '500 GB', interfaz: 'NVMe M.2' },
    compatibilidad: { tipoComponente: 'ALMACENAMIENTO', almacenamientoTipos: ['NVMe M.2'], capacidadMinimaGB: 500 }
  },
  {
    nombre: 'SSD SATA 2.5 480GB',
    categoria: 'Almacenamiento',
    precio: 699,
    descripcion_corta: 'SSD SATA de 480 GB para laptops y PC.',
    tipo_producto: 'SSD',
    detalles_tecnicos: { capacidad: '480 GB', interfaz: 'SATA 2.5"' },
    compatibilidad: { tipoComponente: 'ALMACENAMIENTO', almacenamientoTipos: ['SATA 2.5"'], capacidadMinimaGB: 480 }
  },
  {
    nombre: 'Disco duro SATA 2TB',
    categoria: 'Almacenamiento',
    precio: 1099,
    descripcion_corta: 'Disco duro SATA de 2 TB para almacenamiento general.',
    tipo_producto: 'HDD',
    detalles_tecnicos: { capacidad: '2 TB', interfaz: 'SATA 2.5"' },
    compatibilidad: { tipoComponente: 'ALMACENAMIENTO', almacenamientoTipos: ['SATA 2.5"'], capacidadMinimaGB: 2000 }
  },
  {
    nombre: 'Kit de limpieza para PC y laptop',
    categoria: 'Mantenimiento PC',
    precio: 249,
    descripcion_corta: 'Kit de mantenimiento preventivo para tus equipos.',
    tipo_producto: 'MANTENIMIENTO',
    detalles_tecnicos: { incluye: 'Brocha, aire manual y paño de microfibra' },
    compatibilidad: { tipoComponente: 'OTRO' }
  },
  {
    nombre: 'Batería universal para laptop',
    categoria: 'Repuestos Laptops',
    precio: 899,
    descripcion_corta: 'Batería de reemplazo para modelos compatibles.',
    tipo_producto: 'BATERIA',
    detalles_tecnicos: { garantia: '6 meses' },
    compatibilidad: { tipoComponente: 'OTRO' }
  }
];

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

ejecutar()
  .catch((error) => {
    console.error('No se pudo actualizar el catálogo:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
