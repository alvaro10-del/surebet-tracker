# Surebet Tracker

Herramienta para arbitraje deportivo: calculadora de surebets + control de ganancias y pérdidas + registro de casas de apuestas.

## Cómo abrirla

Doble clic en **`Surebet Tracker.html`**. Se abre en tu navegador, no necesita instalación ni conexión a un servidor.

## Versión pública (para vos y tu amigo)

**https://alvaro10-del.github.io/surebet-tracker/** — abrí ese link directo, no hace falta descargar nada. Corre sobre GitHub Pages a partir de este mismo repo.

## Qué hace

- **Calculadora**: cargá la cuota de cada resultado en distintas casas (2, 3 o más), y te dice si es surebet, cuánto invertir en cada una para ganar lo mismo sin importar el resultado, y el % de ganancia garantizada. Soporta comisión (para exchanges como Betfair).
- **Cargar desde capturas**: pegá (Ctrl+V) o subí capturas de BetBurger u otras apps — Claude identifica la oportunidad, completa las cuotas y te explica cómo ejecutarla. En la versión pública esto pasa por un Worker propio (ver `worker/README.md`); en la versión de claude.ai usa directamente la capacidad de Claude del visor.
- **Registro & P&L**: historial de apuestas, gráfico de banca acumulada, beneficio neto, ROI, capital comprometido por casa.
- **Casas**: estado de cada bookmaker (activa / limitada / cerrada) y notas — útil porque las casas suelen limitar cuentas que detectan haciendo arbitraje.
- **Exportar/Importar backup (JSON)** y **Exportar CSV** del historial, desde la pestaña Registro.

## Local vs. nube (GitHub Pages) vs. artifact de claude.ai

Tanto el `.html` local como la versión pública en GitHub Pages guardan todo en el navegador donde lo abras (`localStorage`), por navegador y equipo — vos y tu amigo no comparten historial entre sí, cada uno ve solo lo que carga en el suyo. Para guardado compartido entre dispositivos existe además la versión en el artifact de claude.ai:

**https://claude.ai/code/artifact/049c1f53-feea-408f-9d9e-c596f6b1f2a7**

## Backup

Guardá una copia de tu historial de vez en cuando con **"Exportar backup (JSON)"** (en la pestaña Registro) y dejala en esta carpeta — como está en OneDrive, queda respaldada y disponible desde cualquier equipo aunque el `localStorage` del navegador se borre. **"Importar backup (JSON)"** la restaura (actualiza lo que coincide por id y agrega el resto, no borra nada existente).

## Antes de apostar con plata real

- Las cuotas cambian en segundos: confirmá el precio vigente en cada casa antes de cargar el monto, no te fíes solo del cálculo.
- Las casas de apuestas limitan o cierran cuentas que detectan arbitrando sistemáticamente.
- Necesitás saldo ya cargado en cada casa involucrada antes de la oportunidad.
- Esta herramienta hace cálculos; no es asesoramiento financiero ni garantiza que una oportunidad siga disponible al momento de confirmar.
