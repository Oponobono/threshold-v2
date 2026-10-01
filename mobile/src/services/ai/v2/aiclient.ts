/**
 * Enlace de IO de AIClientV2.
 *
 * Este archivo es el unico que sabe que hay una red de verdad. Todo lo que decide
 * (clasificar, reintentar, abrir el breaker, respetar los presupuestos) vive en
 * AIClientV2.ts, que es puro y esta probado con reloj falso. Aqui solo se
 * conecta el transporte real y se expone un singleton.
 *
 * Por que NO se conecta en un modulo ya existente de la app
 * ----------------------------------------------------------
 * `services/api/ai.ts` sigue hablando con v1 (`/ai/chat`) y hay una capa entera
 * de componentes que depende de su forma de respuesta. Reemplazarla ahora seria
 * un cambio de comportamiento en 20 pantallas, y este trabajo va de otra cosa:
 * dejar el cliente v2 correcto y medido antes de mover a nadie.
 */

import { AIClientV2 } from './AIClientV2';

let instancia: AIClientV2 | null = null;

/**
 * El transporte real.
 *
 * Se importa perezoso porque `api/client.ts` arrastra los stores de conectividad
 * y el inyector de fallos: importarlo en el modulo que se carga al abrir la app
 * paga ese coste aunque todavia no se vaya a preguntar nada.
 */
async function transporteReal(): Promise<AIClientV2> {
  const { fetchWithFallback } = await import('../../api/client');
  if (!instancia) {
    instancia = new AIClientV2({
      transport: (path, init) => fetchWithFallback(path, init),
    });
  }
  return instancia;
}

/**
 * Cliente v2 para usar desde un componente.
 *
 * Lanza si se llama durante el render. Se obtiene con `await`, y los componentes
 * lo piden en un efecto, no mientras pintan: un modulo que hace un import
 * dinamico tiene que esperarse a un efecto, porque no hay forma de obtenerlo de
 * forma sincronica.
 */
export async function obtenerAIClientV2(): Promise<AIClientV2> {
  return transporteReal();
}

/**
 * Precalentar al abrir la pantalla de IA.
 *
 * Se dispara "y se olvida": el que llama no espera el resultado y no le importa.
 * Un precalentamiento del que se espera una respuesta es un precalentamiento que
 * bloquea la pantalla, que es justo lo contrario de lo que se quiere.
 *
 * @returns el mismo cliente, por comodidad del que ya lo tiene.
 */
export async function precalentarAI(): Promise<void> {
  const client = await transporteReal();
  await client.precalentar();
}

/**
 * Reponer el breaker a mano.
 *
 * Existe para el caso "ya se que el backend volvio y no quiero esperar al TTL".
 * No se llama en ninguna pantalla a proposito: dejarlo en un boton de Ajustes lo
 * convertiria en algo que el usuario aprende a pulsar cuando el problema no es
 * suyo.
 */
export function resetBreakerAI(): void {
  instancia?.cerrarBreaker();
}