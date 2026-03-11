// App Sidebar - Extension Élève

// ─── Firebase Config ───
const firebaseConfig = {
  apiKey: "AIzaSyArYb0lK_mBrBCwXH-lZ4nRvZOQmr12uTg",
  authDomain: "navigationrecherche.firebaseapp.com",
  projectId: "navigationrecherche",
  storageBucket: "navigationrecherche.firebasestorage.app",
  messagingSenderId: "582995150366",
  appId: "1:582995150366:web:092f83b50f51d98651900f",
  measurementId: "G-GZ1V094CHD"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Signaler au background que la sidebar est ouverte
chrome.runtime.connect({ name: "sidebar" });

// ─── État de l'application ───
const state = {
  user: null,
  eleveNom: "",
  eleveId: "",
  questionnaire: null,
  questionnaireId: "",
  questionCourante: 0,
  questions: []
};

// ─── Persistance locale ───
function sauvegarderLocal() {
  chrome.storage.local.set({
    eleveId: state.eleveId,
    eleveNom: state.eleveNom,
    questionnaireId: state.questionnaireId,
    questionCourante: state.questionCourante,
    questionsData: state.questions
  });
}

// ─── Éléments DOM ───
const $ = (sel) => document.querySelector(sel);
const ecranAuth = $("#ecran-auth");
const ecranCode = $("#ecran-code");
const ecranQuestionnaire = $("#ecran-questionnaire");

// ─── Onglets Auth ───
document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const target = tab.dataset.tab;
    if (target === "connexion") {
      $("#form-login").hidden = false;
      $("#form-register").hidden = true;
    } else {
      $("#form-login").hidden = true;
      $("#form-register").hidden = false;
    }
    $("#erreur-auth").hidden = true;
  });
});

// ─── Inscription ───
let inscriptionEnCours = false;

$("#form-register").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nom = $("#register-nom").value.trim();
  const email = $("#register-email").value.trim();
  const password = $("#register-password").value;

  if (!nom || !email || !password) return;
  $("#erreur-auth").hidden = true;

  try {
    inscriptionEnCours = true;
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: nom });
    inscriptionEnCours = false;
    state.user = cred.user;
    state.eleveId = cred.user.uid;
    state.eleveNom = nom;
    afficherEcranCode();
  } catch (err) {
    inscriptionEnCours = false;
    console.error("Erreur inscription:", err);
    let msg = "Erreur lors de la création du compte.";
    if (err.code === "auth/email-already-in-use") msg = "Cette adresse e-mail est déjà utilisée.";
    if (err.code === "auth/weak-password") msg = "Le mot de passe doit contenir au moins 6 caractères.";
    if (err.code === "auth/invalid-email") msg = "Adresse e-mail invalide.";
    $("#erreur-auth").textContent = msg;
    $("#erreur-auth").hidden = false;
  }
});

// ─── Connexion ───
$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;

  if (!email || !password) return;
  $("#erreur-auth").hidden = true;

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    console.error("Erreur connexion:", err);
    let msg = "Erreur de connexion.";
    if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
      msg = "E-mail ou mot de passe incorrect.";
    }
    if (err.code === "auth/too-many-requests") msg = "Trop de tentatives. Réessaie plus tard.";
    $("#erreur-auth").textContent = msg;
    $("#erreur-auth").hidden = false;
  }
});

// ─── Déconnexion ───
$("#btn-deconnexion").addEventListener("click", async () => {
  await auth.signOut();
});

// ─── Listener Auth State ───
auth.onAuthStateChanged(async (user) => {
  if (inscriptionEnCours) return;

  if (user) {
    state.user = user;
    state.eleveId = user.uid;
    state.eleveNom = user.displayName || user.email;
    // Tenter de restaurer une session en cours
    await restaurerSession();
  } else {
    state.user = null;
    state.eleveId = "";
    state.eleveNom = "";
    afficherEcranAuth();
  }
});

async function restaurerSession() {
  try {
    const stored = await chrome.storage.local.get([
      "questionnaireId", "questionCourante", "questionsData"
    ]);

    if (stored.questionnaireId) {
      // Recharger le questionnaire depuis Firestore
      const doc = await db.collection("questionnaires").doc(stored.questionnaireId).get();
      if (doc.exists) {
        state.questionnaire = doc.data();
        state.questionnaireId = stored.questionnaireId;
        state.questionCourante = stored.questionCourante || 0;
        state.questions = stored.questionsData || [];

        // Vérifier que le nombre de questions correspond
        if (state.questions.length !== state.questionnaire.questions.length) {
          // Réinitialiser si le questionnaire a changé
          state.questions = state.questionnaire.questions.map((_, index) => ({
            questionIndex: index,
            reponse: "",
            motsCles: [],
            sitesConsultes: [],
            passages: []
          }));
        }

        afficherQuestionnaireRestaure();
        return;
      }
    }
  } catch (err) {
    console.error("Erreur restauration session:", err);
  }
  afficherEcranCode();
}

function afficherEcranAuth() {
  ecranAuth.hidden = false;
  ecranCode.hidden = true;
  ecranQuestionnaire.hidden = true;
}

function afficherEcranCode() {
  ecranAuth.hidden = true;
  ecranCode.hidden = false;
  ecranQuestionnaire.hidden = true;
  $("#user-nom").textContent = state.eleveNom;
}

// ─── Rejoindre un questionnaire par code ───
$("#form-code").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("#code-acces").value.trim().toUpperCase();
  if (!code) return;

  $("#erreur-code").hidden = true;

  try {
    const snap = await db.collection("questionnaires")
      .where("codeAcces", "==", code)
      .limit(1)
      .get();

    if (snap.empty) {
      $("#erreur-code").textContent = "Code d'accès invalide. Vérifie auprès de ton professeur.";
      $("#erreur-code").hidden = false;
      return;
    }

    const doc = snap.docs[0];
    state.questionnaire = doc.data();
    state.questionnaireId = doc.id;

    afficherQuestionnaire();
  } catch (err) {
    console.error("Erreur code:", err);
    $("#erreur-code").textContent = "Erreur de connexion. Vérifie ta connexion internet.";
    $("#erreur-code").hidden = false;
  }
});

// ─── Retour à l'écran code ───
$("#btn-retour-code").addEventListener("click", () => {
  state.questionnaire = null;
  state.questionnaireId = "";
  state.questionCourante = 0;
  state.questions = [];
  chrome.storage.local.remove(["questionnaireId", "questionCourante", "questionsData"]);
  afficherEcranCode();
});

// ─── Affichage du questionnaire (nouveau) ───
function afficherQuestionnaire() {
  // Initialiser le state par question
  state.questionCourante = 0;
  state.questions = state.questionnaire.questions.map((_, index) => ({
    questionIndex: index,
    reponse: "",
    motsCles: [],
    sitesConsultes: [],
    passages: []
  }));

  sauvegarderLocal();
  afficherQuestionnaireRestaure();
}

// ─── Affichage du questionnaire (restauré ou nouveau) ───
function afficherQuestionnaireRestaure() {
  ecranAuth.hidden = true;
  ecranCode.hidden = true;
  ecranQuestionnaire.hidden = false;

  $("#user-nom-q").textContent = state.eleveNom;

  const q = state.questionnaire;
  $("#titre-questionnaire").textContent = q.titre;
  $("#theme-questionnaire").textContent = q.theme;
  $("#texte-consignes").textContent = q.consignes || "Aucune consigne spécifique.";

  // Réinitialiser le bouton soumettre
  const btn = $("#btn-soumettre");
  btn.disabled = false;
  btn.textContent = "Envoyer mes réponses";
  $("#message-soumission").hidden = true;

  afficherQuestionCourante();
}

// ─── Navigation entre questions ───

function allerAQuestion(index) {
  sauvegarderReponseCourante();
  state.questionCourante = index;
  sauvegarderLocal();
  afficherQuestionCourante();
}

function sauvegarderReponseCourante() {
  if (!state.questionnaire) return;
  const idx = state.questionCourante;
  const question = state.questionnaire.questions[idx];

  if (question.type === "qcm" && question.options) {
    const checked = document.querySelector(`#question-reponse input[name="qcm"]:checked`);
    if (checked) {
      state.questions[idx].reponse = question.options[parseInt(checked.value)];
    }
  } else {
    const textarea = document.querySelector("#question-reponse textarea");
    if (textarea) {
      state.questions[idx].reponse = textarea.value;
    }
  }
  sauvegarderLocal();
}

function afficherQuestionCourante() {
  const idx = state.questionCourante;
  const total = state.questionnaire.questions.length;
  const question = state.questionnaire.questions[idx];
  const qData = state.questions[idx];

  // Compteur
  $("#question-compteur").textContent = `Question ${idx + 1} / ${total}`;

  // Boutons navigation
  $("#btn-prev").disabled = idx === 0;
  $("#btn-next").disabled = idx === total - 1;
  $("#btn-prev-bas").disabled = idx === 0;
  $("#btn-next-bas").disabled = idx === total - 1;

  // Énoncé de la question (haut)
  const texteZone = $("#question-texte-zone");
  texteZone.innerHTML = `<p class="question-texte"><span class="question-numero">${idx + 1}.</span> ${question.texte}</p>`;

  // Zone réponse (bas)
  const reponseZone = $("#question-reponse");

  if (question.type === "qcm" && question.options) {
    reponseZone.innerHTML = `
      <div class="qcm-options">
        ${question.options.map((opt, i) => {
          const selected = qData.reponse === opt;
          return `
            <label class="qcm-option${selected ? " selected" : ""}">
              <input type="radio" name="qcm" value="${i}"${selected ? " checked" : ""}>
              <span>${opt}</span>
            </label>
          `;
        }).join("")}
      </div>
    `;
    reponseZone.querySelectorAll("input[type=radio]").forEach((radio) => {
      radio.addEventListener("change", () => {
        state.questions[idx].reponse = question.options[parseInt(radio.value)];
        reponseZone.querySelectorAll(".qcm-option").forEach((o) => o.classList.remove("selected"));
        radio.closest(".qcm-option").classList.add("selected");
        sauvegarderLocal();
      });
    });
  } else {
    reponseZone.innerHTML = `<textarea placeholder="Ta réponse...">${qData.reponse || ""}</textarea>`;
    reponseZone.querySelector("textarea").addEventListener("input", (e) => {
      state.questions[idx].reponse = e.target.value;
      sauvegarderLocal();
    });
  }

  // Mots-clés
  afficherMotsCles(qData);

  // Sites
  afficherSites(qData);

  // Passages soulignés
  afficherPassages(qData);

  // Dots
  afficherDots();
}

function afficherMotsCles(qData) {
  const container = $("#liste-mots-cles");
  const aucun = $("#aucun-mot-cle");

  container.innerHTML = "";

  if (qData.motsCles.length === 0) {
    aucun.hidden = false;
    return;
  }
  aucun.hidden = true;

  qData.motsCles.forEach((mc) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = mc.texte;
    container.appendChild(span);
  });
}

function afficherSites(qData) {
  const container = $("#liste-sites");
  const compteur = $("#compteur-sites");
  const aucun = $("#aucun-site");

  container.innerHTML = "";
  compteur.textContent = qData.sitesConsultes.length;

  if (qData.sitesConsultes.length === 0) {
    aucun.hidden = false;
    return;
  }
  aucun.hidden = true;

  qData.sitesConsultes.forEach((site, siteIndex) => {
    const div = document.createElement("div");
    div.className = "site-item";
    div.innerHTML = `
      <div class="site-header">
        <span class="site-titre">${site.titre}</span>
        <span class="site-url">${site.url}</span>
      </div>
      <div class="site-controles">
        <div class="site-controle-groupe">
          <span class="site-controle-label">Pertinent</span>
          <input type="checkbox" class="pertinence-check" data-site="${siteIndex}"${site.pertinence ? " checked" : ""}>
        </div>
        <div class="site-controle-groupe">
          <span class="site-controle-label">Fiabilité</span>
          <div class="fiabilite-btns">
            <span class="fiabilite-label">1</span>
            ${[1, 2, 3, 4, 5].map((n) => `
              <button class="fiabilite-btn${site.fiabilite >= n ? " active" : ""}" data-site="${siteIndex}" data-val="${n}"></button>
            `).join("")}
            <span class="fiabilite-label">5</span>
          </div>
        </div>
        ${site.tempsPasse > 0 ? `
          <span class="temps-badge">${formatTemps(site.tempsPasse)}</span>
        ` : ""}
      </div>
    `;

    // Pertinence
    div.querySelector(".pertinence-check").addEventListener("change", (e) => {
      qData.sitesConsultes[siteIndex].pertinence = e.target.checked;
      sauvegarderLocal();
    });

    // Fiabilité (cercles 1-5, tous actifs jusqu'au niveau choisi)
    div.querySelectorAll(".fiabilite-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = parseInt(btn.dataset.val);
        qData.sitesConsultes[siteIndex].fiabilite = val;
        div.querySelectorAll(".fiabilite-btn").forEach((b) => {
          b.classList.toggle("active", parseInt(b.dataset.val) <= val);
        });
        sauvegarderLocal();
      });
    });

    container.appendChild(div);
  });
}

function formatTemps(ms) {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const resteSec = sec % 60;
  return `${min}m${resteSec > 0 ? resteSec + "s" : ""}`;
}

function afficherDots() {
  const container = $("#question-dots");
  container.innerHTML = "";

  state.questions.forEach((qData, i) => {
    const dot = document.createElement("button");
    dot.className = "dot";
    if (i === state.questionCourante) dot.classList.add("active");
    if (qData.reponse) dot.classList.add("answered");
    dot.addEventListener("click", () => allerAQuestion(i));
    container.appendChild(dot);
  });
}

// ─── Event listeners navigation ───
$("#btn-prev").addEventListener("click", () => {
  if (state.questionCourante > 0) allerAQuestion(state.questionCourante - 1);
});
$("#btn-next").addEventListener("click", () => {
  if (state.questionCourante < state.questionnaire.questions.length - 1) allerAQuestion(state.questionCourante + 1);
});
$("#btn-prev-bas").addEventListener("click", () => {
  if (state.questionCourante > 0) allerAQuestion(state.questionCourante - 1);
});
$("#btn-next-bas").addEventListener("click", () => {
  if (state.questionCourante < state.questionnaire.questions.length - 1) allerAQuestion(state.questionCourante + 1);
});

// ─── Réception des messages depuis le content script ───
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "LIEN_COLLECTE") {
    ajouterLien(message.data);
  }
  if (message.type === "REQUETE_RECHERCHE") {
    ajouterMotCle(message.data);
  }
  if (message.type === "TEMPS_PAGE") {
    handleTempsPage(message.data);
  }
  if (message.type === "PASSAGE_SURLIGNE") {
    ajouterPassage(message.data);
  }
});

function ajouterLien(data) {
  const idx = state.questionCourante;
  const qData = state.questions[idx];
  if (!qData) return;

  if (qData.sitesConsultes.some((s) => s.url === data.url)) return;

  qData.sitesConsultes.push({
    url: data.url,
    titre: data.titre,
    timestamp: data.timestamp,
    pertinence: false,
    fiabilite: 0,
    tempsPasse: 0
  });

  if (state.questionCourante === idx) {
    afficherSites(qData);
  }

  sauvegarderLocal();
  sauvegarderRecherches();
}

function ajouterMotCle(data) {
  const idx = state.questionCourante;
  const qData = state.questions[idx];
  if (!qData) return;

  if (qData.motsCles.some((mc) => mc.texte === data.texte)) return;

  qData.motsCles.push({ texte: data.texte, timestamp: data.timestamp });

  if (state.questionCourante === idx) {
    afficherMotsCles(qData);
  }

  sauvegarderLocal();
  sauvegarderRecherches();
}

function handleTempsPage(data) {
  let changed = false;
  state.questions.forEach((qData) => {
    qData.sitesConsultes.forEach((site) => {
      if (site.url === data.url) {
        site.tempsPasse += data.tempsPasse;
        changed = true;
      }
    });
  });

  if (changed) {
    sauvegarderLocal();

    const currentQ = state.questions[state.questionCourante];
    if (currentQ && currentQ.sitesConsultes.some((s) => s.url === data.url)) {
      afficherSites(currentQ);
    }
  }
}

function ajouterPassage(data) {
  const idx = state.questionCourante;
  const qData = state.questions[idx];
  if (!qData) return;

  if (!qData.passages) qData.passages = [];

  qData.passages.push({
    texte: data.texte,
    couleur: data.couleur,
    url: data.url,
    timestamp: data.timestamp
  });

  if (state.questionCourante === idx) {
    afficherPassages(qData);
  }

  sauvegarderLocal();
}

function afficherPassages(qData) {
  const container = $("#liste-passages");
  const compteur = $("#compteur-passages");
  const aucun = $("#aucun-passage");

  const passages = qData.passages || [];
  container.innerHTML = "";
  compteur.textContent = passages.length;

  if (passages.length === 0) {
    aucun.hidden = false;
    return;
  }
  aucun.hidden = true;

  passages.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "passage-item";
    div.innerHTML = `
      <div class="passage-couleur" style="background: ${p.couleur}"></div>
      <div class="passage-contenu">
        <div class="passage-texte">${p.texte}</div>
        <div class="passage-url">${new URL(p.url).hostname}</div>
      </div>
      <button class="passage-suppr" data-idx="${i}" title="Supprimer">&times;</button>
    `;

    div.querySelector(".passage-suppr").addEventListener("click", () => {
      qData.passages.splice(i, 1);
      afficherPassages(qData);
      sauvegarderLocal();
    });

    container.appendChild(div);
  });
}

// ─── Sauvegarde des recherches dans Firestore ───
async function sauvegarderRecherches() {
  if (!state.eleveId) return;
  try {
    const parQuestion = state.questions.map((qData) => ({
      questionIndex: qData.questionIndex,
      requetes: qData.motsCles,
      clics: qData.sitesConsultes.map((s) => ({
        url: s.url, titre: s.titre, timestamp: s.timestamp, tempsPasse: s.tempsPasse
      }))
    }));

    await db.collection("recherches").doc(state.eleveId).set({
      eleveNom: state.eleveNom,
      questionnaireId: state.questionnaireId,
      parQuestion
    }, { merge: true });
  } catch (err) {
    console.error("Erreur sauvegarde recherches:", err);
  }
}

// ─── Soumission des réponses ───
$("#btn-soumettre").addEventListener("click", async () => {
  sauvegarderReponseCourante();

  const btn = $("#btn-soumettre");
  const msg = $("#message-soumission");

  const premiereManquante = state.questions.findIndex((q) => !q.reponse || !q.reponse.trim());
  if (premiereManquante !== -1) {
    const manquantes = state.questions.filter((q) => !q.reponse || !q.reponse.trim()).length;
    msg.textContent = `Il reste ${manquantes} question(s) sans réponse.`;
    msg.className = "erreur";
    msg.hidden = false;
    allerAQuestion(premiereManquante);
    btn.disabled = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = "Envoi en cours...";

  try {
    await db.collection("questionnaires")
      .doc(state.questionnaireId)
      .collection("reponses")
      .doc(state.eleveId)
      .set({
        eleveNom: state.eleveNom,
        eleveEmail: state.user?.email || "",
        questions: state.questions.map((qData) => ({
          questionIndex: qData.questionIndex,
          reponse: qData.reponse,
          motsCles: qData.motsCles,
          sitesConsultes: qData.sitesConsultes,
          passages: qData.passages || []
        })),
        soumisLe: firebase.firestore.FieldValue.serverTimestamp()
      });

    await sauvegarderRecherches();

    msg.textContent = "Réponses envoyées avec succès !";
    msg.className = "succes";
    msg.hidden = false;
    btn.textContent = "Envoyé ✓";
  } catch (err) {
    console.error("Erreur soumission:", err);
    msg.textContent = "Erreur lors de l'envoi. Réessaie.";
    msg.className = "erreur";
    msg.hidden = false;
    btn.disabled = false;
    btn.textContent = "Envoyer mes réponses";
  }
});
