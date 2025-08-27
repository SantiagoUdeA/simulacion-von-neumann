// Versión Avanzada - Máquina de Von Neumann
// Botones
const btnAnterior = document.getElementById("anterior");
const btnSiguiente = document.getElementById("siguiente");
const btnEjecutar = document.getElementById("ejecutar");
const btnReset = document.getElementById("reset");
const btnCargarPrograma = document.getElementById("cargarPrograma");

// Referencias DOM
const memoriaTabla = document.querySelectorAll(".memory-table tbody tr");
const regDireccion = document.getElementById("regDireccion");
const regDatos = document.getElementById("regDatos");
const decodificador = document.getElementById("decodificador");
const pc = document.getElementById("pc");
const regInstruccion = document.getElementById("regInstruccion");
const acumulador = document.getElementById("acumulador");
const regEntrada = document.getElementById("regEntrada");
const stepText = document.getElementById("stepText");

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
btnCargarPrograma.addEventListener("click", cargarPrograma);

// Event listeners para actualizar memoria cuando cambian X e Y
inputX.addEventListener("input", actualizarMemoriaInput);
inputY.addEventListener("input", actualizarMemoriaInput);

function actualizarMemoriaInput() {
    const x = parseInt(inputX.value) || 0;
    const y = parseInt(inputY.value) || 0;
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

// Mapa de opcodes (4 bits) para representar instrucciones en memoria (opcode + dir operando)
const OPCODES = {
    LOD: "0001",
    ADD: "0010",
    SUB: "0011",
    MUL: "0100",
    DIV: "0101",
    STO: "0110",
    HLT: "1111"
};

// Direcciones simbólicas de variables
const SIMBOLOS_DIR = {
    X: "0000",
    Y: "0001",
    Z: "0110"
};

function encodeInstruction(inst, arg) {
    inst = (inst || "").toUpperCase();
    const opcode = OPCODES[inst];
    if (!opcode) return "00000000"; // desconocida
    if (inst === "HLT") return opcode + "0000"; // sin operando
    const dir = SIMBOLOS_DIR[arg] || "0000"; // default 0000
    return opcode + dir;
}

function decodeInstruction(byte8) {
    if (!/^([01]{8})$/.test(byte8)) return { inst: "???", arg: "" };
    const opcode = byte8.slice(0,4);
    const dir = byte8.slice(4);
    const inst = Object.entries(OPCODES).find(([k,v]) => v === opcode)?.[0] || "???";
    const arg = Object.entries(SIMBOLOS_DIR).find(([k,v]) => v === dir)?.[0] || "";
    return { inst, arg };
}

function parseProgramaDesdeTextarea() {
    const lineasRaw = programInput.value.split(/\n+/);
    const errores = [];
    const instrucciones = [];
    lineasRaw.forEach((l, idx) => {
        const linea = l.trim();
        if (!linea) return; // saltar vacías
        if (linea.startsWith("#") || linea.startsWith("//")) return; // comentario
        const partes = linea.split(/\s+/);
        const inst = (partes[0] || "").toUpperCase();
        const arg = (partes[1] || "").toUpperCase();
        if (!OPCODES[inst]) {
            errores.push(`Línea ${idx+1}: instrucción desconocida "${linea}"`);
            return;
        }
        if (inst !== "HLT" && !SIMBOLOS_DIR[arg]) {
            errores.push(`Línea ${idx+1}: operando inválido "${arg}"`);
            return;
        }
        if (inst === "HLT" && arg) {
            errores.push(`Línea ${idx+1}: HLT no lleva operando`);
            return;
        }
        instrucciones.push({ inst, arg: inst === "HLT" ? undefined : arg });
    });
    return { instrucciones, errores };
}

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

    stepText.textContent = descripcion;
}

// Construir programa desde textarea + valores X/Y
function construirPrograma() {
    const valorX = parseInt(inputX.value) || 0;
    const valorY = parseInt(inputY.value) || 0;

    const { instrucciones } = parseProgramaDesdeTextarea();
    programa = [];

    let pcVirtual = 0; // contador de programa simulado (no confundir con el input visual)

    instrucciones.forEach(({ inst, arg }) => {
        const argDir = SIMBOLOS_DIR[arg] || "0000";
        const argVal = arg === "X" ? valorX : arg === "Y" ? valorY : (arg === "Z" ? (parseInt(inputZ.value) || 0) : 0);

        // FETCH
        programa.push({ tipo: "pc->ri", dir: pcVirtual.toString(2).padStart(4, "0") });
        programa.push({ tipo: "pc++", dir: pcVirtual.toString(2).padStart(4, "0") });
        programa.push({ tipo: "mem->rd", dir: pcVirtual.toString(2).padStart(4, "0") });
        programa.push({ tipo: "rd->ri", inst: inst + (arg ? " " + arg : "") });
        programa.push({ tipo: "decode", inst });

        if (inst !== "HLT") {
            programa.push({ tipo: "ri->ra", argDir });
            // obtener valor operando
            const valOperando = arg === "X" ? valorX : arg === "Y" ? valorY : arg === "Z" ? (parseInt(inputZ.value) || 0) : 0;
            programa.push({ tipo: "mem->rd-op", dir: argDir, valor: valOperando });
            programa.push({ tipo: "rd->re", valor: valOperando });
        }

        switch (inst) {
            case "LOD":
                programa.push({ tipo: "execute", op: "LOD", res: argVal });
                break;
            case "ADD":
                // tomar último resultado o acumulador previo
                const ultimoAdd = programa.findLast(p => p.tipo === "execute")?.res ?? valorX;
                programa.push({ tipo: "execute", op: "+", res: ultimoAdd + argVal });
                break;
            case "SUB":
                const ultimoSub = programa.findLast(p => p.tipo === "execute")?.res ?? valorX;
                programa.push({ tipo: "execute", op: "-", res: ultimoSub - argVal });
                break;
            case "MUL":
                const ultimoMul = programa.findLast(p => p.tipo === "execute")?.res ?? valorX;
                programa.push({ tipo: "execute", op: "*", res: ultimoMul * argVal });
                break;
            case "DIV":
                const ultimoDiv = programa.findLast(p => p.tipo === "execute")?.res ?? valorX;
                programa.push({ tipo: "execute", op: "/", res: argVal !== 0 ? Math.trunc(ultimoDiv / argVal) : 0 });
                break;
            case "STO":
                const ultimo = programa.findLast(p => p.tipo === "execute")?.res || 0;
                programa.push({ tipo: "store", dir: argDir, valor: ultimo });
                break;
            case "HLT":
                programa.push({ tipo: "end" });
                break;
        }

        pcVirtual++;
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
    stepText.textContent = "Listo para ejecutar programa...";

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
    stepText.textContent = "Programa cargado. Listo para ejecutar...";

    // Actualizar memoria con valores actuales de X e Y
    const x = parseInt(inputX.value) || 0;
    const y = parseInt(inputY.value) || 0;
    const rowX = getRowByDir("0000");
    const rowY = getRowByDir("0001");
    const rowZ = getRowByDir("0110");
    if (rowX) rowX.children[1].textContent = to8bit(x);
    if (rowY) rowY.children[1].textContent = to8bit(y);
    if (rowZ) rowZ.children[1].textContent = "00000000";

    // Parsear + validar programa
    const { instrucciones, errores } = parseProgramaDesdeTextarea();

    if (errores.length) {
        alert("Errores al cargar programa:\n" + errores.join("\n"));
        programa = [];
        return;
    }

    // Verificar espacio en memoria (direcciones disponibles para instrucciones 0010..0101)
    const filas = Array.from(memoriaTabla);
    const filasInstrucciones = filas.filter(tr => {
        const dir = (tr.children[0]?.textContent || "").trim();
        return ["0010","0011","0100","0101"].includes(dir);
    });
    if (instrucciones.length > filasInstrucciones.length) {
        alert(`El programa (${instrucciones.length} instrucciones) excede la memoria disponible (${filasInstrucciones.length}).`);
        programa = [];
        return;
    }

    // Escribir instrucciones codificadas en memoria
    instrucciones.forEach((ins, idx) => {
        const tr = filasInstrucciones[idx];
        if (tr) tr.children[1].textContent = encodeInstruction(ins.inst, ins.arg);
    });
    // Limpiar celdas restantes
    for (let i = instrucciones.length; i < filasInstrucciones.length; i++) {
        filasInstrucciones[i].children[1].textContent = "00000000";
    }

    // Construir micro-pasos
    construirPrograma();

    console.log("Programa cargado correctamente. Instrucciones:", instrucciones.length, "Pasos:", programa.length);
    alert(`Programa cargado exitosamente!\nInstrucciones: ${instrucciones.length}\nPasos micro: ${programa.length}`);
}

// Inicialización
window.addEventListener('load', () => {
    // Establecer valores iniciales en memoria
    const x = parseInt(inputX.value) || 0;
    const y = parseInt(inputY.value) || 0;
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
