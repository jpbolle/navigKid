import { NextRequest, NextResponse } from "next/server";
import type { Question, ReponseQuestion, CorrectionIA } from "@/lib/types";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-api-key-here") {
    return NextResponse.json(
      { error: "Clé API Claude non configurée. Ajoutez ANTHROPIC_API_KEY dans .env.local" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { questions, reponses } = body as {
    questions: Question[];
    reponses: ReponseQuestion[];
  };

  if (!questions || !reponses) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const corrections: CorrectionIA[] = [];

  for (const rep of reponses) {
    const question = questions[rep.questionIndex];
    if (!question) continue;

    // QCM : pas de correction IA, juste les sources
    if (question.type === "qcm") {
      corrections.push({
        questionIndex: rep.questionIndex,
        sourcesEvaluation: {
          pertinence: rep.sources.length >= question.nbSources ? 80 : 40,
          commentaire: rep.sources.length >= question.nbSources
            ? `${rep.sources.length} source(s) collectée(s) sur ${question.nbSources} demandée(s).`
            : `Seulement ${rep.sources.length} source(s) sur ${question.nbSources} demandée(s).`,
        },
        reponseEvaluation: {
          pertinence: -1, // -1 = QCM, pas corrigé par IA
          commentaire: "QCM — correction automatique.",
          coherenceExtraits: rep.sources.some((s) => s.extraits.length > 0)
            ? "Des extraits ont été soulignés pour appuyer le choix."
            : "Aucun extrait souligné.",
        },
        noteGlobale: -1,
        feedback: "Question QCM — la correction se fait automatiquement.",
      });
      continue;
    }

    // Question ouverte : appel à Claude
    const sourcesDesc = rep.sources
      .map((s, i) => {
        const extraitsStr = s.extraits.length > 0
          ? `\n  Extraits soulignés par l'élève :\n${s.extraits.map((e, j) => `    ${j + 1}. "${e}"`).join("\n")}`
          : "\n  Aucun extrait souligné.";
        return `Source ${i + 1} : ${s.titre} (${s.url})${extraitsStr}`;
      })
      .join("\n\n");

    const prompt = `Tu es un correcteur pédagogique. Évalue la réponse d'un élève à une question de recherche documentaire.

QUESTION : ${question.texte}
Nombre de sources demandées : ${question.nbSources}

SOURCES COLLECTÉES PAR L'ÉLÈVE :
${sourcesDesc || "Aucune source collectée."}

RÉPONSE DE L'ÉLÈVE :
${rep.reponse || "Aucune réponse fournie."}

Évalue en JSON strict (pas de markdown, pas de commentaires) :
{
  "sourcesEvaluation": {
    "pertinence": <0-100>,
    "commentaire": "<évaluation de la qualité et pertinence des sources>"
  },
  "reponseEvaluation": {
    "pertinence": <0-100>,
    "commentaire": "<évaluation de la qualité de la réponse>",
    "coherenceExtraits": "<les extraits soulignés appuient-ils la réponse ? explication>"
  },
  "noteGlobale": <0-100>,
  "feedback": "<feedback constructif et bienveillant pour l'élève, 2-3 phrases>"
}`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Erreur Claude API:", errText);
        corrections.push({
          questionIndex: rep.questionIndex,
          sourcesEvaluation: { pertinence: 0, commentaire: "Erreur lors de la correction." },
          reponseEvaluation: { pertinence: 0, commentaire: "Erreur API.", coherenceExtraits: "" },
          noteGlobale: 0,
          feedback: "Une erreur est survenue lors de la correction automatique.",
        });
        continue;
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || "";

      // Extraire le JSON de la réponse
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        corrections.push({
          questionIndex: rep.questionIndex,
          ...parsed,
        });
      } else {
        corrections.push({
          questionIndex: rep.questionIndex,
          sourcesEvaluation: { pertinence: 0, commentaire: "Réponse IA non interprétable." },
          reponseEvaluation: { pertinence: 0, commentaire: text, coherenceExtraits: "" },
          noteGlobale: 0,
          feedback: text,
        });
      }
    } catch (err) {
      console.error("Erreur correction question", rep.questionIndex, err);
      corrections.push({
        questionIndex: rep.questionIndex,
        sourcesEvaluation: { pertinence: 0, commentaire: "Erreur réseau." },
        reponseEvaluation: { pertinence: 0, commentaire: "Erreur.", coherenceExtraits: "" },
        noteGlobale: 0,
        feedback: "Impossible de contacter le service de correction.",
      });
    }
  }

  return NextResponse.json({ corrections });
}
