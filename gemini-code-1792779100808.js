const pantallaLogin = document.getElementById('pantalla-login');
const pantallaApp = document.getElementById('pantalla-app');
const inputPin = document.getElementById('login-pin');
const loginUsuario = document.getElementById('login-usuario');
const btnLoginPin = document.getElementById('btn-login-pin');
const btnLoginFace = document.getElementById('btn-login-faceid');

const selectorUsuario = document.getElementById('usuario-activo');
const btnEditarUsuarios = document.getElementById('btn-editar-usuarios');
const tituloMes = document.getElementById('mes-actual');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');

// CONTENEDORES DE VISTAS
const vistaMesContainer = document.getElementById('vista-mes-container');
const vistaAnualContainer = document.getElementById('vista-anual-container');
const btnToggleVista = document.getElementById('btn-toggle-vista');
const calendarGrid = document.getElementById('calendar-grid');

// ESTADOS ACTUALIZADOS
const estados = [
  { id: 'vacio', clase: 'estado-vacio', texto: '' },
  { id: 'libre', clase: 'estado-libre', texto: 'L' },
  { id: 'manana', clase: 'estado-manana', texto: 'M' },
  { id: 'tarde', clase: 'estado-tarde', texto: 'T' },
  { id: 'noche', clase: 'estado-noche', texto: 'N' },
  { id: 'vacaciones', clase: 'estado-vacaciones', texto: 'V' }
];
const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const nombresDias = ['L','M','X','J','V','S','D'];

// --- 1. CONFIGURACIÓN DE SUPABASE ---
const supabaseUrl = 'https://idpgvtixeyytfgpkqjjm.supabase.co';
const supabaseKey = 'sb_publishable_S7NTo7XKekBigTm8U17rQA_u2Cp0SrI'; 
const supabaseApp = supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. SISTEMA DE LOGIN Y ROLES ---
let usuarioLogueado = ''; 
let miUsuario = '';       
let esAdmin = false;
let modoVista = 'mes'; 

btnLoginPin.addEventListener('click', async () => {
  const pinIntento = inputPin.value;
  const usuarioIntento = loginUsuario.value;

  if (pinIntento.length < 4) return alert('Introduce tu PIN de 4 dígitos');
  btnLoginPin.textContent = 'Comprobando...';

  try {
    const { data, error } = await supabaseApp.from('perfiles').select('*').eq('nombre', usuarioIntento).eq('pin', pinIntento);
    btnLoginPin.textContent = 'Entrar con PIN';

    if (error) return alert('🚨 ERROR DE SUPABASE: ' + error.message);
    if (!data || data.length === 0) return alert(`❌ Datos incorrectos.`);

    usuarioLogueado = usuarioIntento; 
    miUsuario = usuarioIntento; 
    esAdmin = (data[0].rol === 'admin');
    
    pantallaLogin.style.display = 'none'; 
    pantallaApp.style.display = 'block';
    btnEditarUsuarios.style.display = esAdmin ? 'inline-block' : 'none';
    
    renderizarSelector();
    iniciarCalendario();
    cargarChatInicial();
    setTimeout(cargarVotaciones, 500); 
    
  } catch (err) {
    alert('🚨 ERROR FATAL: ' + err.message);
    btnLoginPin.textContent = 'Entrar con PIN';
  }
});

btnLoginFace.addEventListener('click', () => {
  alert('La biometría FaceID se configurará cuando subamos la app a internet con HTTPS.');
});

// --- 3. GESTIÓN DINÁMICA DE USUARIOS ---
let usuarios = ['Cule', 'Persona 2', 'Persona 3', 'Persona 4'];
try {
  const guardados = JSON.parse(localStorage.getItem('listaUsuarios'));
  if (Array.isArray(guardados) && guardados.length > 0) usuarios = guardados;
} catch (error) { localStorage.removeItem('listaUsuarios'); }

function renderizarSelector() {
  selectorUsuario.innerHTML = ''; 
  usuarios.forEach(u => {
    const option = document.createElement('option');
    option.value = u; option.textContent = u; selectorUsuario.appendChild(option);
  });
  if (usuarios.includes(miUsuario)) selectorUsuario.value = miUsuario;
}

btnEditarUsuarios.addEventListener('click', () => {
  const input = prompt('Escribe los nombres separados por comas:', usuarios.join(', '));
  if (input !== null) {
    let nuevosUsuarios = input.split(',').map(n => n.trim()).filter(n => n !== '');
    if (nuevosUsuarios.length === 0) nuevosUsuarios = ['Cule']; 
    usuarios = nuevosUsuarios;
    localStorage.setItem('listaUsuarios', JSON.stringify(usuarios));
    renderizarSelector(); iniciarCalendario();
  }
});

// --- 4. NAVEGACIÓN Y VISTAS ---
let fechaNavegacion = new Date(); 

btnToggleVista.addEventListener('click', () => {
  modoVista = modoVista === 'mes' ? 'anio' : 'mes';
  
  if (modoVista === 'mes') {
    btnToggleVista.textContent = '📅 Cambiar a Vista Anual';
    vistaMesContainer.style.display = 'block';
    vistaAnualContainer.style.display = 'none';
  } else {
    btnToggleVista.textContent = '📆 Volver a Vista Mensual';
    vistaMesContainer.style.display = 'none';
    vistaAnualContainer.style.display = 'block';
  }
  iniciarCalendario();
});

btnPrev.addEventListener('click', () => {
  if (modoVista === 'mes') fechaNavegacion.setMonth(fechaNavegacion.getMonth() - 1);
  else fechaNavegacion.setFullYear(fechaNavegacion.getFullYear() - 1);
  iniciarCalendario();
});

btnNext.addEventListener('click', () => {
  if (modoVista === 'mes') fechaNavegacion.setMonth(fechaNavegacion.getMonth() + 1);
  else fechaNavegacion.setFullYear(fechaNavegacion.getFullYear() + 1);
  iniciarCalendario();
});

selectorUsuario.addEventListener('change', (e) => {
  miUsuario = e.target.value;
  iniciarCalendario();
});

// --- 5. LÓGICA DE NUBE ---
async function guardarTurnoNube(dia, indiceEstado, mesAnioEspecifico = null) {
  const mesAnio = mesAnioEspecifico || `${fechaNavegacion.getFullYear()}-${fechaNavegacion.getMonth()}`;
  const { data, error: errorLeer } = await supabaseApp.from('Turnos').select('id').eq('dia', dia).eq('usuario', miUsuario).eq('mes_anio', mesAnio);

  if (data && data.length > 0) {
    await supabaseApp.from('Turnos').update({ indiceEstado: indiceEstado }).eq('id', data[0].id);
  } else {
    await supabaseApp.from('Turnos').insert({ dia: dia, usuario: miUsuario, indiceEstado: indiceEstado, mes_anio: mesAnio });
  }
}

async function obtenerTurnosMesNube() {
  const { data, error } = await supabaseApp.from('Turnos').select('*').eq('usuario', miUsuario).eq('mes_anio', `${fechaNavegacion.getFullYear()}-${fechaNavegacion.getMonth()}`);
  return data || [];
}

async function obtenerTurnosAnoNube() {
  const { data, error } = await supabaseApp.from('Turnos').select('*').eq('usuario', miUsuario).like('mes_anio', `${fechaNavegacion.getFullYear()}-%`);
  return data || [];
}

// --- 6. RENDERIZADO CALENDARIOS ---
async function iniciarCalendario() {
  if (modoVista === 'mes') await renderizarMes();
  else await renderizarAno();
}

async function renderizarMes() {
  calendarGrid.innerHTML = ''; 
  const mes = fechaNavegacion.getMonth();
  const anio = fechaNavegacion.getFullYear();
  tituloMes.textContent = `${nombresMeses[mes]} ${anio}`; 

  const diasEnElMes = new Date(anio, mes + 1, 0).getDate();
  let diaEmpieza = new Date(anio, mes, 1).getDay();
  diaEmpieza = diaEmpieza === 0 ? 6 : diaEmpieza - 1;

  const datosGuardados = await obtenerTurnosMesNube();
  const historial = {};
  datosGuardados.forEach(dato => historial[dato.dia] = dato.indiceEstado);

  for (let i = 0; i < diaEmpieza; i++) {
    const emptyDiv = document.createElement('div');
    emptyDiv.classList.add('empty-cell');
    calendarGrid.appendChild(emptyDiv);
  }

  for (let i = 1; i <= diasEnElMes; i++) {
    const dayCell = document.createElement('div');
    let indice = historial[i] !== undefined ? historial[i] : 0;
    
    dayCell.classList.add('day', estados[indice].clase);
    dayCell.innerHTML = `<span class="day-number">${i}</span><span class="shift-label">${estados[indice].texto}</span>`;

    dayCell.addEventListener('click', () => {
      if (!esAdmin && miUsuario !== usuarioLogueado) return alert('Solo puedes editar tus turnos.');
      indice = (indice + 1) % estados.length;
      dayCell.className = `day ${estados[indice].clase}`;
      dayCell.innerHTML = `<span class="day-number">${i}</span><span class="shift-label">${estados[indice].texto}</span>`;
      guardarTurnoNube(i, indice);
    });
    calendarGrid.appendChild(dayCell);
  }
}

async function renderizarAno() {
  vistaAnualContainer.innerHTML = '';
  const anio = fechaNavegacion.getFullYear();
  tituloMes.textContent = `Año ${anio}`;

  const datosGuardados = await obtenerTurnosAnoNube();
  const historialAno = {};
  for(let i=0; i<12; i++) historialAno[i] = {};
  
  datosGuardados.forEach(dato => {
    const m = parseInt(dato.mes_anio.split('-')[1]);
    historialAno[m][dato.dia] = dato.indiceEstado;
  });

  const gridAnual = document.createElement('div');
  gridAnual.className = 'vista-anual-grid';

  for (let mes = 0; mes < 12; mes++) {
    const mesDiv = document.createElement('div');
    mesDiv.className = 'mini-mes';
    mesDiv.innerHTML = `<h4>${nombresMeses[mes]}</h4>`;

    const weekDiv = document.createElement('div');
    weekDiv.className = 'mini-weekdays';
    nombresDias.forEach(d => { weekDiv.innerHTML += `<div>${d}</div>`; });
    mesDiv.appendChild(weekDiv);

    const miniGrid = document.createElement('div');
    miniGrid.className = 'mini-days-grid';

    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    let diaEmpieza = new Date(anio, mes, 1).getDay();
    diaEmpieza = diaEmpieza === 0 ? 6 : diaEmpieza - 1;

    for (let i = 0; i < diaEmpieza; i++) miniGrid.innerHTML += `<div class="empty-cell"></div>`;

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const dayCell = document.createElement('div');
      let indice = historialAno[mes][dia] !== undefined ? historialAno[mes][dia] : 0;
      
      dayCell.className = `mini-day ${estados[indice].clase}`;
      dayCell.textContent = dia;

      dayCell.addEventListener('click', () => {
        if (!esAdmin && miUsuario !== usuarioLogueado) return alert('Solo puedes editar tus turnos.');
        indice = (indice + 1) % estados.length;
        dayCell.className = `mini-day ${estados[indice].clase}`;
        guardarTurnoNube(dia, indice, `${anio}-${mes}`);
      });
      miniGrid.appendChild(dayCell);
    }
    mesDiv.appendChild(miniGrid);
    gridAnual.appendChild(mesDiv);
  }
  vistaAnualContainer.appendChild(gridAnual);
}

// --- 7. BUSCADOR DE COINCIDENCIAS Y FUEGOS ARTIFICIALES ---
const btnCoincidencias = document.getElementById('btn-coincidencias');
const resultadoCoincidencias = document.getElementById('resultado-coincidencias');

btnCoincidencias.addEventListener('click', async () => {
  resultadoCoincidencias.classList.add('visible'); 
  resultadoCoincidencias.innerHTML = 'Buscando...';
  
  const { data, error } = await supabaseApp.from('Turnos').select('*').eq('indiceEstado', 1).eq('mes_anio', `${fechaNavegacion.getFullYear()}-${fechaNavegacion.getMonth()}`); 

  if (error) return resultadoCoincidencias.innerHTML = 'Error al buscar datos.';

  const conteo = {};
  data.forEach(t => {
    if (!conteo[t.dia]) conteo[t.dia] = new Set();
    if (usuarios.includes(t.usuario)) conteo[t.dia].add(t.usuario);
  });

  const diasComunes = [];
  const diasEnElMes = new Date(fechaNavegacion.getFullYear(), fechaNavegacion.getMonth() + 1, 0).getDate();
  for (let dia = 1; dia <= diasEnElMes; dia++) {
    if (conteo[dia] && conteo[dia].size === usuarios.length) diasComunes.push(dia);
  }

  if (diasComunes.length === 0) {
    resultadoCoincidencias.innerHTML = '😅 <strong>No hay coincidencias.</strong><br>Ningún día libráis todos a la vez este mes.';
  } else {
    resultadoCoincidencias.innerHTML = `🎉 <strong>¡Días libres en común!</strong><br>Todos coincidís los días: <strong>${diasComunes.join(', ')}</strong>`;
    
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
    
    function randomInRange(min, max) { return Math.random() * (max - min) + min; }
    
    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
  }
});

// --- 8. RELLENO SECUENCIA ---
const btnSecuencia = document.getElementById('btn-secuencia');

btnSecuencia.addEventListener('click', async () => {
  if (!esAdmin && miUsuario !== usuarioLogueado) return alert('Solo tu propio calendario.');
  
  const input = prompt('Escribe tu patrón (ej: M,M,T,T,N,N,L,L,V,X):');
  if (!input) return;

  const mapa = { 'x': 0, 'l': 1, 'm': 2, 't': 3, 'n': 4, 'v': 5 };
  const patron = input.split(',').map(letra => mapa[letra.trim().toLowerCase()]).filter(num => num !== undefined);

  if (patron.length === 0) return alert('Patrón no válido.');
  if (!confirm(`¿Aplicar a todo el mes?`)) return;

  btnSecuencia.textContent = '⏳ Guardando...';
  const diasEnElMes = new Date(fechaNavegacion.getFullYear(), fechaNavegacion.getMonth() + 1, 0).getDate();
  const promesas = [];

  for (let dia = 1; dia <= diasEnElMes; dia++) {
    promesas.push(guardarTurnoNube(dia, patron[(dia - 1) % patron.length]));
  }

  await Promise.all(promesas);
  btnSecuencia.textContent = '✨ Rellenar mes por secuencia';
  iniciarCalendario();
});

// --- 9. SISTEMA DE VOTACIONES (Con Ranking y Ordenación) ---
const listaVotaciones = document.getElementById('lista-votaciones');

async function cargarVotaciones() {
  const { data, error } = await supabaseApp.from('votaciones').select('*');
  if (error || !data) return;

  const votacionesProcesadas = data.map(item => {
    let votantes = [];
    try { votantes = JSON.parse(item.votantes || '[]'); } catch (e) { votantes = []; }
    return { ...item, votantes, numVotos: votantes.length };
  });

  votacionesProcesadas.sort((a, b) => b.numVotos - a.numVotos);

  listaVotaciones.innerHTML = '';
  votacionesProcesadas.forEach(item => {
    const yaVote = item.votantes.includes(usuarioLogueado);
    
    const div = document.createElement('div');
    div.className = `opcion-voto ${yaVote ? 'votado' : ''}`;
    
    div.innerHTML = `
      <span class="opcion-texto">${item.opcion}</span>
      <div class="opcion-bar">
        <span>${item.numVotos > 0 ? item.votantes.join(', ') : 'Sin votos'}</span>
        <span class="voto-badge">${item.numVotos}</span>
      </div>
    `;

    div.addEventListener('click', async () => {
      let nuevosVotantes = [...item.votantes];
      if (yaVote) {
        nuevosVotantes = nuevosVotantes.filter(v => v !== usuarioLogueado);
      } else {
        nuevosVotantes.push(usuarioLogueado);
      }
      
      div.style.opacity = '0.5';
      await supabaseApp.from('votaciones').update({ votantes: JSON.stringify(nuevosVotantes) }).eq('id', item.id);
      cargarVotaciones(); 
    });

    listaVotaciones.appendChild(div);
  });
}

supabaseApp.channel('votaciones-cambios').on('postgres_changes', { event: '*', schema: 'public', table: 'votaciones' }, () => {
  cargarVotaciones();
}).subscribe();

// --- 10. CHAT Y TEMA ---
const chatMensajes = document.getElementById('chat-mensajes');
const chatInput = document.getElementById('chat-input');
const btnEnviarMsg = document.getElementById('btn-enviar-msg');
const selectorTema = document.getElementById('selector-tema');

function pintarMensaje(msg) {
  const div = document.createElement('div');
  const esMio = msg.usuario === usuarioLogueado;
  div.className = `mensaje ${esMio ? 'propio' : 'ajeno'}`;
  div.innerHTML = `<strong>${esMio ? 'Tú' : msg.usuario}:</strong> ${msg.texto}`;
  chatMensajes.appendChild(div);
  chatMensajes.scrollTop = chatMensajes.scrollHeight;
}

async function cargarChatInicial() {
  chatMensajes.innerHTML = ''; 
  const { data, error } = await supabaseApp.from('mensajes').select('*').order('created_at', { ascending: true });
  if (!error && data) data.forEach(pintarMensaje);
}

async function enviarMensaje() {
  const texto = chatInput.value.trim();
  if (!texto) return; 
  chatInput.value = ''; 
  await supabaseApp.from('mensajes').insert({ usuario: usuarioLogueado, texto: texto });
}

btnEnviarMsg.addEventListener('click', enviarMensaje);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviarMensaje(); });

supabaseApp.channel('chat-directo').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
  pintarMensaje(payload.new);
}).subscribe();

if (selectorTema) {
  const temaGuardado = localStorage.getItem('tema-kedadas') || 'auto';
  selectorTema.value = temaGuardado; aplicarTema(temaGuardado);
  selectorTema.addEventListener('change', (e) => {
    localStorage.setItem('tema-kedadas', e.target.value);
    aplicarTema(e.target.value);
  });
}

function aplicarTema(tema) {
  const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (tema === 'dark' || (tema === 'auto' && prefiereOscuro)) document.body.classList.add('dark-theme');
  else document.body.classList.remove('dark-theme');
}