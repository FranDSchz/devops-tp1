# Guion breve: que es una race condition y cual es el problema

## Apertura (20 segundos)

Una condicion de carrera aparece cuando varias operaciones concurrentes acceden
a un estado compartido y el resultado depende de como se intercalan sus pasos.
En una aplicacion web puede ser un problema de integridad y seguridad: por
ejemplo, que un cupon de un solo uso se acepte mas de una vez.

## Presentar nuestro caso (15 segundos)

En OpsBoard tenemos un incidente que solo puede tener un responsable. Ana y Bruno
intentan tomarlo a la vez, mediante dos APIs que comparten Redis. La regla es:
si esta libre, se asigna; si ya tiene responsable, se rechaza el intento.

## Narrar la animacion vulnerable (45 segundos)

1. Ambos envian un POST para tomar el mismo incidente. Son dos peticiones distintas.
2. Las dos APIs consultan antes de que alguna escriba: ambas ven LIBRE.
3. Ana guarda su nombre y recibe exito.
4. Bruno sigue usando la lectura anterior, sin comprobar de nuevo, y guarda su
   nombre sobre el de Ana. Bruno tambien recibe exito.
5. Al final hay un nombre guardado, pero dos personas creen haber conseguido el
   incidente. Una asignacion se perdio. Ambos podrian empezar el mismo trabajo.

Los nombres pueden invertirse segun el ensayo: narrar quien gano realmente.

## Explicar la ventana (20 segundos)

El punto clave esta entre COMPROBAR y ASIGNAR. Que estuviera libre cuando lo lei
no garantiza que siga libre cuando escribo. Este caso sigue el patron TOCTOU,
time-of-check to time-of-use. No hace falta que todo suceda en el mismo instante:
basta con ese intercalado. No todas las condiciones de carrera son TOCTOU.

## Cierre y pase al companero (10 segundos)

El problema no es que Redis guarde dos nombres al mismo tiempo. El problema es
confirmar dos asignaciones incompatibles. Ahora mi companero muestra como
proteger la operacion para que solo una solicitud reciba exito.

## Si preguntan por la demo

- Son POST reales a dos APIs en Docker, con Redis compartido. La imagen reconstruye
  una ejecucion ya terminada; no representa sus tiempos reales.
- Hay una pausa educativa de 500 ms para facilitar la carrera. El defecto es
  separar comprobar y escribir; la pausa permite observarlo.
- En la comparacion protegida no implementamos un mutex de aplicacion: un script
  Lua comprueba y asigna sin que otro comando se intercale. La operacion de Bruno
  se representa pendiente hasta que termina la primera. Al ejecutarse, encuentra
  el incidente ocupado. Los turnos dibujados son conceptuales, no cola medida.

## Criterio practico si pregunta el profesor

Antes de recomendar proteccion preguntaria: que recurso compartimos, que regla
no puede romperse, cuantos procesos pueden modificarlo y que daño genera una
doble confirmacion. La necesidad aparece cuando varias operaciones pueden
colisionar y violar esa regla; no simplemente porque haya muchos usuarios.

Referencia conceptual: https://portswigger.net/web-security/race-conditions
