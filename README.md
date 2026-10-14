# Techstore

## Pagos PayPal en sandbox

El botón de PayPal usa el entorno de pruebas de PayPal. Crea una aplicación en el
[PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) y agrega sus
credenciales al archivo `.env`:

```env
PAYPAL_CLIENT_ID=AQAQdQ9aS_WGFLWEfTb1Kr0my_-0sl3z4CMPBsQB0I27NwM88lykTM0PkkejeLtafOVgcta_zuOjyDJW
PAYPAL_CLIENT_SECRET=EBpSu-mo-gXfREz3_vqoqtTzjBE9pWSNAOQ3DCck-odQcQRho-Iq39z19Sp8BauD1_FXnhJJDzwly0pB
PAYPAL_API_BASE_URL=https://api-m.sandbox.paypal.com
```

Usa una cuenta personal de prueba (Sandbox Personal) para aprobar el pago en el
checkout. El secreto nunca se expone al navegador; solamente el Client ID se
entrega al frontend para cargar el SDK de PayPal.