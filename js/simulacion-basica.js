// Versión Avanzada - Máquina de Von Neumann
// Botones
const btnAnterior = document.getElementById("anterior");
const btnSiguiente = document.getElementById("siguiente");
const btnEjecutar = document.getElementById("ejecutar");
const btnReset = document.getElementById("reset");
// const btnCargarPrograma = document.getElementById("cargarPrograma");

// Referencias DOM
const memoriaTabla = document.querySelectorAll(".memory-table tbody tr");
const regDireccion = document.getElementById("regDireccion");
const regDatos = document.getElementById("regDatos");
const decodificador = document.getElementById("decodificador");
const pc = document.getElementById("pc");
const regInstruccion = document.getElementById("regInstruccion");
const acumulador = document.getElementById("acumulador");
const regEntrada = document.getElementById("regEntrada");

// Inputs usuario
const inputX = document.getElementById("inputX");
const inputY = document.getElementById("inputY");
const inputZ = document.getElementById("inputZ");
const programInput = document.getElementById("programInput");

const showInstructions = document.getElementById("showInstructions");
showInstructions.addEventListener("click", () => {
    window.alert("Instrucciones permitidas:\n\n• LOD X/Y - Cargar valor en acumulador\n• ADD X/Y - Sumar al acumulador\n• SUB X/Y - Restar del acumulador\n• MUL X/Y - Multiplicar acumulador\n• DIV X/Y - Dividir acumulador\n• STO Z - Guardar acumulador en Z\n• HLT - Fin del programa");
});

// Evento para cargar programa
// btnCargarPrograma.addEventListener("click", cargarPrograma);

function actualizarMemoriaInput() {
    const x = 5;
    const y = 11;
    const rowX = getRowByDir("0000");
    const rowY = getRowByDir("0001");
    if (rowX) rowX.children[1].textContent = to8bit(x);
    if (rowY) rowY.children[1].textContent = to8bit(y);

    // Reconstruir programa con nuevos valores
    if (programa.length > 0) {
        construirPrograma();
    }
}

// Utils
const MICRO_DELAY = 500; // tiempo entre micro-pasos
let paso = 0;
let programa = [];
let enEjecucion = false;
let pausarEjecucion = false; // Nueva variable para controlar la pausa

// Función para actualizar el estado de los botones
function actualizarEstadoBotones() {
    const ejecutandoAutomatico = enEjecucion && !pausarEjecucion;

    // Deshabilitar/habilitar botones según el estado
    btnAnterior.disabled = ejecutandoAutomatico;
    btnSiguiente.disabled = ejecutandoAutomatico;

    // Cambiar estilos visuales
    if (ejecutandoAutomatico) {
        btnAnterior.style.opacity = '0.5';
        btnAnterior.style.cursor = 'not-allowed';
        btnSiguiente.style.opacity = '0.5';
        btnSiguiente.style.cursor = 'not-allowed';
    } else {
        btnAnterior.style.opacity = '1';
        btnAnterior.style.cursor = 'pointer';
        btnSiguiente.style.opacity = '1';
        btnSiguiente.style.cursor = 'pointer';
    }
}

// Helpers
const to8bit = n => (((n % 256) + 256) % 256).toString(2).padStart(8, "0");
const getRowByDir = dir => {
    for (const row of memoriaTabla) {
        if ((row.children[0]?.textContent || "").trim() === dir) return row;
    }
    return null;
};

function limpiarVista() {
    regDireccion.value = "0000";
    regDatos.value = "00000000";
    regInstruccion.value = "";
    decodificador.value = "";
    regEntrada.value = "";
    acumulador.value = "";
}

function limpiarResaltados() {
    document.querySelectorAll(".activo").forEach(el => el.classList.remove("activo"));
}

// Función para actualizar la descripción del paso actual
function actualizarDescripcionPaso(step) {
    let descripcion = "";

    switch (step.tipo) {
        case "fetch":
            descripcion = `FETCH: Obteniendo instrucción de la dirección ${step.dir} en memoria`;
            break;
        case "decode":
            descripcion = `DECODE: Decodificando la instrucción "${step.inst}" en el decodificador`;
            break;
        case "fetch-op":
            descripcion = `FETCH OPERANDO: Obteniendo el valor ${step.valor} de la dirección ${step.dir}`;
            break;
        case "execute":
            descripcion = `EXECUTE: Ejecutando operación ${step.op}, resultado: ${step.res}`;
            break;
        case "store":
            descripcion = `STORE: Guardando resultado ${step.valor} en la dirección ${step.dir}`;
            break;
        case "end":
            descripcion = "FIN: Programa terminado exitosamente";
            break;
        default:
            descripcion = "Preparando siguiente operación...";
            break;
    }
}

// Construir programa desde textarea + valores X/Y
function construirPrograma() {
    const valorX = 5;
    const valorY = 11;

    const lineas = programInput.value.trim().split("\n").map(l => l.trim());

    programa = [];

    let pc = 0; // contador de programa simulado

    lineas.forEach(linea => {
        const [inst, arg] = linea.split(" ");
        const argDir = (arg === "X") ? "0000" : (arg === "Y") ? "0001" : "0110";
        const argVal = (arg === "X") ? valorX : (arg === "Y") ? valorY : 0;

        // === FETCH micro-pasos ===
        programa.push({ tipo: "pc->ri", dir: pc.toString(2).padStart(4, "0") }); // p1
        programa.push({ tipo: "pc++", dir: pc.toString(2).padStart(4, "0") });   // p2
        programa.push({ tipo: "mem->rd", dir: pc.toString(2).padStart(4, "0") }); // p3
        programa.push({ tipo: "rd->ri", inst: inst + " " + (arg || "") });       // p4-5
        programa.push({ tipo: "decode", inst });                                 // p6

        // === Si hay operando (LOD, ADD, SUB, MUL, DIV, STO) ===
        if (["LOD", "ADD", "SUB", "MUL", "DIV", "STO"].includes(inst)) {
            programa.push({ tipo: "ri->ra", argDir });                           // p7
            programa.push({ tipo: "mem->rd-op", dir: argDir, valor: argVal });   // p8-9
            programa.push({ tipo: "rd->re", valor: argVal });                    // p10
        }

        // === EJECUCIÓN según instrucción ===
        switch (inst) {
            case "LOD":
                programa.push({ tipo: "execute", op: "LOD", res: argVal });
                break;
            case "ADD":
                programa.push({ tipo: "execute", op: "+", res: valorX + valorY });
                break;
            case "SUB":
                programa.push({ tipo: "execute", op: "-", res: valorX - valorY });
                break;
            case "MUL":
                programa.push({ tipo: "execute", op: "*", res: valorX * valorY });
                break;
            case "DIV":
                programa.push({ tipo: "execute", op: "/", res: valorY !== 0 ? Math.floor(valorX / valorY) : 0 });
                break;
            case "STO":
                const ultimo = programa.findLast(p => p.tipo === "execute")?.res || 0;
                programa.push({ tipo: "store", dir: argDir, valor: ultimo });
                break;
            case "HLT":
                programa.push({ tipo: "end" });
                break;
        }

        pc++; // siguiente instrucción en memoria
    });
}


// Ejecuta UN paso como secuencia de micro-pasos, secuencial (Promise)
function ejecutarPaso(step) {
    return new Promise(resolve => {
        // Actualizar descripción del paso
        actualizarDescripcionPaso(step);

        limpiarVista();
        limpiarResaltados();

        let microPasos = [];

        switch (step.tipo) {
            case "fetch":
                microPasos = [
                    () => { pc.value = step.dir; pc.classList.add("activo"); },
                    () => { regDireccion.value = step.dir; regDireccion.classList.add("activo"); },
                    () => { regDatos.value = "00000000"; regDatos.classList.add("activo"); }
                ];
                break;

            case "decode":
                microPasos = [
                    () => { regInstruccion.value = step.inst; regInstruccion.classList.add("activo"); },
                    () => { decodificador.value = step.inst; decodificador.classList.add("activo"); }
                ];
                break;

            case "fetch-op":
                microPasos = [
                    () => {
                        regDireccion.value = step.dir;
                        regDireccion.classList.add("activo");
                        const row = getRowByDir(step.dir);
                        if (row) row.classList.add("activo");
                    },
                    () => {
                        regDatos.value = to8bit(step.valor);
                        regDatos.classList.add("activo");
                    },
                    () => {
                        regEntrada.value = to8bit(step.valor);
                        regEntrada.classList.add("activo");
                    }
                ];
                break;

            case "execute":
                microPasos = [
                    () => { decodificador.value = "EJECUTANDO " + step.op; decodificador.classList.add("activo"); },
                    () => { acumulador.value = to8bit(step.res); acumulador.classList.add("activo"); }
                ];
                break;

            case "store":
                microPasos = [
                    () => { acumulador.value = to8bit(step.valor); acumulador.classList.add("activo"); },
                    () => {
                        const row = getRowByDir(step.dir);
                        if (row) {
                            row.children[1].textContent = to8bit(step.valor);
                            row.classList.add("activo");
                        }
                    },
                    () => { inputZ.value = step.valor; } // resultado en decimal para el usuario
                ];
                break;

            case "end":
                microPasos = [
                    () => { decodificador.value = "FIN DEL PROGRAMA"; decodificador.classList.add("activo"); }
                ];
                break;

            case "pc->ri":
                microPasos = [
                    () => { pc.value = step.dir; pc.classList.add("activo"); },
                    () => { regDireccion.value = step.dir; regDireccion.classList.add("activo"); }
                ];
                break;

            case "pc++":
                microPasos = [
                    () => {
                        pc.value = (parseInt(step.dir, 2) + 1).toString(2).padStart(4, "0");
                        pc.classList.add("activo");
                    }
                ];
                break;

            case "mem->rd":
                microPasos = [
                    () => {
                        const row = getRowByDir(step.dir);
                        if (row) {
                            row.classList.add("activo");
                            regDatos.value = row.children[1].textContent;
                            regDatos.classList.add("activo");
                        }
                    }
                ];
                break;

            case "rd->ri":
                microPasos = [
                    () => { regInstruccion.value = step.inst; regInstruccion.classList.add("activo"); }
                ];
                break;

            case "decode":
                microPasos = [
                    () => { /* aquí puedes solo resaltar el decodificador */ }
                ];
                break;

            case "ri->ra":
                microPasos = [
                    () => { regDireccion.value = step.argDir; regDireccion.classList.add("activo"); }
                ];
                break;

            case "mem->rd-op":
                microPasos = [
                    () => {
                        const row = getRowByDir(step.dir);
                        if (row) {
                            row.classList.add("activo");
                            regDatos.value = to8bit(step.valor);
                            regDatos.classList.add("activo");
                        }
                    }
                ];
                break;

            case "rd->re":
                microPasos = [
                    () => { regEntrada.value = to8bit(step.valor); regEntrada.classList.add("activo"); }
                ];
                break;
        }

        microPasos.forEach((fn, i) => setTimeout(fn, i * MICRO_DELAY));
        setTimeout(resolve, microPasos.length * MICRO_DELAY);
    });
}

// —— Controles ——

// Siguiente (respeta micro-pasos)
btnSiguiente.addEventListener("click", async () => {
    if (btnSiguiente.disabled) return; // Prevenir ejecución si está deshabilitado
    if (enEjecucion && !pausarEjecucion) return; // No permitir si está ejecutando
    if (programa.length === 0) construirPrograma();
    if (paso >= programa.length) return;

    // Resetear estado de pausa si está pausado
    if (pausarEjecucion) {
        pausarEjecucion = false;
        btnEjecutar.textContent = "Ejecutar";
        actualizarEstadoBotones();
    }

    enEjecucion = true;
    await ejecutarPaso(programa[paso]);
    paso++;
    enEjecucion = false;
});

// Ejecutar todo (secuencial, sin solapes)
btnEjecutar.addEventListener("click", async () => {
    if (enEjecucion && !pausarEjecucion) {
        // Si está ejecutando, pausar
        pausarEjecucion = true;
        btnEjecutar.textContent = "▶️";
        actualizarEstadoBotones(); // Habilitar botones al pausar
        return;
    }

    if (pausarEjecucion) {
        // Si está pausado, continuar
        pausarEjecucion = false;
        btnEjecutar.textContent = "⏸️";
        actualizarEstadoBotones(); // Deshabilitar botones al continuar

        // Continuar desde donde se pausó
        for (let i = paso; i < programa.length && !pausarEjecucion; i++) {
            await ejecutarPaso(programa[i]);
            paso = i + 1;

            // Pequeña pausa para permitir que se procese el clic de pausa
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        if (paso >= programa.length || pausarEjecucion) {
            enEjecucion = false;
            btnEjecutar.textContent = "▶️";
            actualizarEstadoBotones(); // Habilitar botones al finalizar
        }
        return;
    }

    // Ejecutar desde el principio
    if (enEjecucion) return;
    construirPrograma();
    paso = 0;
    pausarEjecucion = false;
    enEjecucion = true;
    btnEjecutar.textContent = "⏸️";
    actualizarEstadoBotones(); // Deshabilitar botones al iniciar

    for (let i = 0; i < programa.length && !pausarEjecucion; i++) {
        await ejecutarPaso(programa[i]);
        paso = i + 1;

        // Pequeña pausa para permitir que se procese el clic de pausa
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    enEjecucion = false;
    pausarEjecucion = false;
    btnEjecutar.textContent = "▶️";
    actualizarEstadoBotones(); // Habilitar botones al finalizar
});

// Anterior (re-ejecuta el paso anterior)
btnAnterior.addEventListener("click", async () => {
    if (btnAnterior.disabled) return; // Prevenir ejecución si está deshabilitado
    if (enEjecucion && !pausarEjecucion) return; // No permitir si está ejecutando
    if (paso <= 0) return;

    // Resetear estado de pausa si está pausado
    if (pausarEjecucion) {
        pausarEjecucion = false;
        enEjecucion = false;
        btnEjecutar.textContent = "▶️";
        actualizarEstadoBotones();
    }

    paso--;
    enEjecucion = true;
    await ejecutarPaso(programa[paso]);
    enEjecucion = false;
});

// Reset (restaura memoria y limpia registros)
btnReset.addEventListener("click", () => {
    if (enEjecucion && !pausarEjecucion) return; // No permitir reset durante ejecución activa

    // Resetear todos los estados
    paso = 0;
    enEjecucion = false;
    pausarEjecucion = false;
    btnEjecutar.textContent = "▶️";
    actualizarEstadoBotones(); // Habilitar todos los botones

    limpiarVista();
    limpiarResaltados();
    inputZ.value = "";

    // Refrescar memoria con X/Y actuales
    const x = parseInt(inputX.value) || 0;
    const y = parseInt(inputY.value) || 0;
    const rowX = getRowByDir("0000");
    const rowY = getRowByDir("0001");
    const rowZ = getRowByDir("0110");
    if (rowX) rowX.children[1].textContent = to8bit(x);
    if (rowY) rowY.children[1].textContent = to8bit(y);
    if (rowZ) rowZ.children[1].textContent = "00000000";

    construirPrograma();
});

// Cargar Programa (desde textarea, sin ejecutar)
function cargarPrograma() {
    if (enEjecucion && !pausarEjecucion) return; // No permitir durante ejecución activa

    // Resetear estados
    paso = 0;
    enEjecucion = false;
    pausarEjecucion = false;
    btnEjecutar.textContent = "▶️";
    actualizarEstadoBotones(); // Habilitar todos los botones

    limpiarVista();
    limpiarResaltados();
    inputZ.value = "";

    // Actualizar memoria con valores actuales de X e Y
    const x = parseInt(inputX.value) || 0;
    const y = parseInt(inputY.value) || 0;
    const rowX = getRowByDir("0000");
    const rowY = getRowByDir("0001");
    const rowZ = getRowByDir("0110");
    if (rowX) rowX.children[1].textContent = to8bit(x);
    if (rowY) rowY.children[1].textContent = to8bit(y);
    if (rowZ) rowZ.children[1].textContent = "00000000";

    // Construir nuevo programa
    construirPrograma();

    // Mostrar confirmación
    console.log("Programa cargado correctamente. Pasos totales:", programa.length);

    // Opcional: mostrar alerta de confirmación
    if (programa.length > 0) {
        alert(`Programa cargado exitosamente!\nSe generaron ${programa.length} pasos de ejecución.`);
    } else {
        alert("No se encontraron instrucciones válidas en el programa.");
    }
}

// Inicialización
window.addEventListener('load', () => {
    // Establecer valores iniciales en memoria
    const x = 5;
    const y = 11;
    const rowX = getRowByDir("0000");
    const rowY = getRowByDir("0001");
    if (rowX) rowX.children[1].textContent = to8bit(x);
    if (rowY) rowY.children[1].textContent = to8bit(y);

    construirPrograma();

    // Establecer estado inicial de botones
    actualizarEstadoBotones();
});

// Añadir estilos CSS para elementos activos
const style = document.createElement('style');
style.textContent = `
    /* Bordes por defecto para evitar layout shift */
    input:not(#inputX):not(#inputY):not(#inputZ), textarea:not(#programInput) {
        border: 2px solid transparent !important;
        transition: all 0.3s ease;
    }
    
    /* Inputs del usuario con estilo especial */
    #inputX, #inputY, #inputZ, #programInput {
        border: 2px solid rgba(255, 255, 255, 0.3) !important;
        transition: all 0.3s ease;
    }
    
    #inputX:focus, #inputY:focus, #programInput:focus {
        border-color: rgba(100, 149, 237, 0.8) !important;
        box-shadow: 0 0 10px rgba(100, 149, 237, 0.5);
    }
    
    table td, table th {
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        transition: all 0.3s ease;
    }
    
    table tr {
        border: 2px solid transparent !important;
        transition: all 0.3s ease;
    }
    
    .activo {
        background-color: rgba(255, 255, 0, 0.3) !important;
        border: 2px solid #ffff00 !important;
        transition: all 0.3s ease;
        box-shadow: 0 0 10px rgba(255, 255, 0, 0.5);
    }
    
    table tr.activo {
        background-color: rgba(255, 255, 0, 0.2) !important;
        border: 2px solid #ffff00 !important;
    }
    
    table tr.activo td {
        background-color: rgba(255, 255, 0, 0.2) !important;
        border-color: #ffff00 !important;
    }
    
    input.activo:not(#inputX):not(#inputY):not(#inputZ), textarea.activo:not(#programInput) {
        box-shadow: 0 0 15px rgba(255, 255, 0, 0.7);
        animation: pulse 1s infinite;
    }
    
    @keyframes pulse {
        0% { box-shadow: 0 0 15px rgba(255, 255, 0, 0.7); }
        50% { box-shadow: 0 0 25px rgba(255, 255, 0, 0.9); }
        100% { box-shadow: 0 0 15px rgba(255, 255, 0, 0.7); }
    }
`;
document.head.appendChild(style);
