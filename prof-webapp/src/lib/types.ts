// ─── Question (prof crée) ───
export interface Question {
  texte: string;                    // L'énoncé de la question
  type: "texte" | "qcm";           // Réponse ouverte ou QCM
  options?: string[];               // Options QCM
  correctes?: number[];             // Indices des bonnes réponses QCM (plusieurs possibles)
  nbSources: number;                // Nombre de sources web requises (1 par défaut)
  points?: number;                  // Nombre de points pour cette question
  reponseAttendue?: string;         // Réponse attendue / éléments de correction (pour le prof)
  referencesProf?: string[];        // URLs de référence suggérées (pour le prof, à vérifier)
}

// ─── Questionnaire ───
export interface Questionnaire {
  id: string;
  titre: string;
  theme: string;
  consignes: string;
  questions: Question[];
  codeAcces: string;
  profId: string;
  archive?: boolean;
  creeLe: { toDate: () => Date } | null;
}

// ─── Source collectée par l'élève pour une question ───
export interface SourceCollectee {
  url: string;
  titre: string;
  extraits: string[];               // Passages soulignés/surlignés par l'élève
}

// ─── Site consulté avec tracking (nouveau format extension) ───
export interface SiteConsulte {
  url: string;
  titre: string;
  timestamp: number;
  pertinence: boolean;
  fiabilite: number;                // 0 = non évalué, 1-5
  tempsPasse: number;               // en ms
}

// ─── Passage surligné par l'élève ───
export interface Passage {
  texte: string;
  couleur: string;                  // ex: "#fff176" (jaune), "#a5d6a7" (vert)
  url: string;
  timestamp: number;
}

// ─── Données par question (nouveau format extension) ───
export interface QuestionData {
  questionIndex: number;
  reponse: string;
  motsCles: { texte: string; timestamp: number }[];
  sitesConsultes: SiteConsulte[];
  passages?: Passage[];
}

// ─── Réponse de l'élève à une question (ancien format) ───
export interface ReponseQuestion {
  questionIndex: number;
  sources: SourceCollectee[];       // Sources web collectées
  reponse: string;                  // Réponse texte ou option QCM choisie
}

// ─── Correction par Claude ───
export interface CorrectionIA {
  questionIndex: number;
  // Partie A : évaluation des sources
  sourcesEvaluation: {
    pertinence: number;             // 0-100
    commentaire: string;
  };
  // Partie B : évaluation de la réponse
  reponseEvaluation: {
    pertinence: number;             // 0-100
    commentaire: string;
    coherenceExtraits: string;      // Les extraits soulignés appuient-ils la réponse ?
  };
  noteGlobale: number;              // 0-100
  feedback: string;                 // Feedback global pour l'élève
}

// ─── Réponse complète d'un élève ───
export interface Reponse {
  id: string;
  eleveNom: string;
  eleveEmail?: string;
  // Nouveau format (par question)
  questions?: QuestionData[];
  // Ancien format (rétrocompatibilité)
  reponses?: ReponseQuestion[];
  liensCollectes?: { url: string; titre: string; commentaire: string }[];
  corrections?: CorrectionIA[];     // Rempli après correction par Claude
  soumisLe: { toDate: () => Date } | null;
}

// ─── Données recherche par question ───
export interface RechercheParQuestion {
  questionIndex: number;
  requetes: { texte: string; timestamp: number }[];
  clics: { url: string; titre: string; timestamp: number; tempsPasse?: number }[];
}

// ─── Recherches Google de l'élève ───
export interface Recherche {
  id: string;
  eleveNom: string;
  questionnaireId: string;
  // Nouveau format
  parQuestion?: RechercheParQuestion[];
  // Ancien format (rétrocompatibilité)
  requetes?: { texte: string; timestamp: number }[];
  clics?: { url: string; titre: string; timestamp: number }[];
}

export function formatDate(timestamp: { toDate: () => Date } | null): string {
  if (!timestamp) return "—";
  const date = timestamp.toDate();
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
