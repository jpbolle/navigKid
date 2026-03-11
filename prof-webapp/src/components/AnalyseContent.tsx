"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getQuestionnaire,
  getReponses,
  getRecherchesParQuestionnaire,
} from "@/lib/firebase";
import {
  type Questionnaire,
  type Reponse,
  type Recherche,
} from "@/lib/types";

function formatTemps(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const resteSec = sec % 60;
  return `${min}m${resteSec > 0 ? resteSec + "s" : ""}`;
}

export default function AnalyseContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [reponses, setReponses] = useState<Reponse[]>([]);
  const [recherches, setRecherches] = useState<Recherche[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (!id) {
      setErreur("Aucun questionnaire sélectionné.");
      setLoading(false);
      return;
    }

    async function charger() {
      try {
        const q = await getQuestionnaire(id!);
        if (!q) { setErreur("Questionnaire introuvable."); setLoading(false); return; }
        setQuestionnaire(q);

        const reps = await getReponses(id!);
        setReponses(reps);

        const rech = await getRecherchesParQuestionnaire(id!);
        setRecherches(rech);
      } catch (err) {
        console.error(err);
        setErreur("Erreur de chargement.");
      } finally {
        setLoading(false);
      }
    }

    charger();
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-6 h-6 border-3 border-cream-dark border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="bg-red-50 text-danger border border-red-200 rounded p-4 text-sm">
        {erreur} <Link href="/" className="underline">Retour</Link>
      </div>
    );
  }

  if (!questionnaire) return null;

  // ─── Calculs d'analyse (rétrocompatibles) ───

  const nbEleves = reponses.length;

  // Total sites/liens
  const totalSites = reponses.reduce((s, r) => {
    if (r.questions) {
      return s + r.questions.reduce((acc, q) => acc + (q.sitesConsultes?.length || 0), 0);
    }
    return s + (r.liensCollectes?.length || 0);
  }, 0);
  const moyenneSites = nbEleves > 0 ? (totalSites / nbEleves).toFixed(1) : "0";

  // Total requêtes
  const totalRequetes = recherches.reduce((s, r) => {
    if (r.parQuestion) {
      return s + r.parQuestion.reduce((acc, pq) => acc + (pq.requetes?.length || 0), 0);
    }
    return s + (r.requetes?.length || 0);
  }, 0);
  const moyenneRequetes = nbEleves > 0 ? (totalRequetes / nbEleves).toFixed(1) : "0";

  // Mots-clés les plus fréquents
  const motsCles: Record<string, number> = {};
  recherches.forEach((r) => {
    const allRequetes = r.parQuestion
      ? r.parQuestion.flatMap((pq) => pq.requetes || [])
      : (r.requetes || []);
    allRequetes.forEach((req) => {
      const mots = req.texte.toLowerCase().split(/\s+/);
      mots.forEach((mot) => {
        if (mot.length > 2) {
          motsCles[mot] = (motsCles[mot] || 0) + 1;
        }
      });
    });
  });
  const topMotsCles = Object.entries(motsCles)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  // Domaines les plus visités
  const domaines: Record<string, number> = {};
  reponses.forEach((r) => {
    if (r.questions) {
      r.questions.forEach((qData) => {
        (qData.sitesConsultes || []).forEach((site) => {
          try {
            const domain = new URL(site.url).hostname.replace("www.", "");
            domaines[domain] = (domaines[domain] || 0) + 1;
          } catch { /* ignore */ }
        });
      });
    } else {
      (r.liensCollectes || []).forEach((l) => {
        try {
          const domain = new URL(l.url).hostname.replace("www.", "");
          domaines[domain] = (domaines[domain] || 0) + 1;
        } catch { /* ignore */ }
      });
    }
  });
  const topDomaines = Object.entries(domaines)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Temps moyen par site (nouveau format uniquement)
  const tempsParSite: number[] = [];
  reponses.forEach((r) => {
    if (r.questions) {
      r.questions.forEach((qData) => {
        (qData.sitesConsultes || []).forEach((site) => {
          if (site.tempsPasse > 0) tempsParSite.push(site.tempsPasse);
        });
      });
    }
  });
  const tempsMoyen = tempsParSite.length > 0
    ? Math.round(tempsParSite.reduce((a, b) => a + b, 0) / tempsParSite.length)
    : 0;

  // Taux de complétion par question
  const tauxParQuestion = (questionnaire.questions || []).map((q, index) => {
    const repondues = reponses.filter((r) => {
      if (r.questions) {
        return r.questions.some((qd) => qd.questionIndex === index && qd.reponse?.trim());
      }
      return r.reponses?.some((rep) => rep.questionIndex === index && rep.reponse?.trim());
    }).length;
    return {
      texte: q.texte,
      type: q.type,
      taux: nbEleves > 0 ? Math.round((repondues / nbEleves) * 100) : 0,
      repondues,
    };
  });

  // QCM : répartition des réponses
  const qcmStats = (questionnaire.questions || []).map((q, index) => {
    if (q.type !== "qcm" || !q.options) return null;
    const distribution: Record<string, number> = {};
    q.options.forEach((opt) => { distribution[opt] = 0; });
    reponses.forEach((r) => {
      let reponseTexte: string | undefined;
      if (r.questions) {
        const qd = r.questions.find((qd) => qd.questionIndex === index);
        reponseTexte = qd?.reponse;
      } else {
        const rep = r.reponses?.find((rep) => rep.questionIndex === index);
        reponseTexte = rep?.reponse;
      }
      if (reponseTexte && distribution[reponseTexte] !== undefined) {
        distribution[reponseTexte]++;
      }
    });
    return { index, texte: q.texte, options: q.options, distribution };
  }).filter(Boolean);

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary tracking-wide">Analyse des résultats</h1>
        <div className="divider"><span>{questionnaire.titre}</span></div>
        <div className="flex justify-center gap-3 mt-2">
          <span className="bg-primary-light text-primary px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider">
            {questionnaire.theme}
          </span>
          <span className="bg-accent-light text-accent px-3 py-1 rounded text-xs font-mono font-bold tracking-widest">
            {questionnaire.codeAcces}
          </span>
        </div>
      </div>

      <div className="flex justify-between mb-6">
        <Link
          href={`/results?id=${id}`}
          className="bg-cream-dark text-[#8a7f72] px-4 py-2 rounded text-xs font-bold uppercase tracking-widest no-underline border border-[#d5cec4] hover:bg-[#d5cec4] transition-colors"
        >
          Voir les réponses détaillées
        </Link>
        <Link
          href="/"
          className="bg-cream-dark text-[#8a7f72] px-4 py-2 rounded text-xs font-bold uppercase tracking-widest no-underline border border-[#d5cec4] hover:bg-[#d5cec4] transition-colors"
        >
          Retour
        </Link>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { val: nbEleves, label: "Élèves" },
          { val: moyenneSites, label: "Sites / élève" },
          { val: moyenneRequetes, label: "Recherches / élève" },
          { val: tempsMoyen > 0 ? formatTemps(tempsMoyen) : totalSites, label: tempsMoyen > 0 ? "Temps moy. / site" : "Sites total" },
        ].map((s) => (
          <div key={s.label} className="carte-samr text-center">
            <div className="text-3xl font-black text-primary" style={{ fontFamily: "var(--font-display)" }}>
              {s.val}
            </div>
            <div className="label-upper mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Taux de complétion */}
      <div className="carte-samr mb-6">
        <h3 className="text-lg font-bold text-primary mb-4">Taux de complétion par question</h3>
        <div className="space-y-3">
          {tauxParQuestion.map((q, i) => (
            <div key={i}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium truncate" style={{ maxWidth: "70%" }}>
                  {i + 1}. {q.texte}
                </span>
                <span className="label-upper">{q.repondues}/{nbEleves} — {q.taux}%</span>
              </div>
              <div className="w-full h-2 bg-cream-dark rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${q.taux}%`,
                    backgroundColor: q.taux >= 80 ? "var(--color-primary)" : q.taux >= 50 ? "var(--color-accent)" : "var(--color-danger)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QCM Stats */}
      {qcmStats.length > 0 && (
        <div className="carte-samr mb-6">
          <h3 className="text-lg font-bold text-primary mb-4">Répartition des réponses QCM</h3>
          <div className="space-y-6">
            {qcmStats.map((q) => q && (
              <div key={q.index}>
                <p className="text-sm font-semibold mb-2">{q.index + 1}. {q.texte}</p>
                <div className="space-y-1.5">
                  {q.options.map((opt) => {
                    const count = q.distribution[opt];
                    const pct = nbEleves > 0 ? Math.round((count / nbEleves) * 100) : 0;
                    return (
                      <div key={opt} className="flex items-center gap-3">
                        <span className="text-xs w-32 truncate" style={{ color: "#8a7f72" }}>{opt}</span>
                        <div className="flex-1 h-5 bg-cream-dark rounded overflow-hidden">
                          <div
                            className="h-full bg-accent rounded flex items-center justify-end pr-2"
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          >
                            <span className="text-[10px] text-white font-bold">{count}</span>
                          </div>
                        </div>
                        <span className="label-upper w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mots-clés */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="carte-samr">
          <h3 className="text-lg font-bold text-primary mb-4">Mots-clés fréquents</h3>
          {topMotsCles.length === 0 ? (
            <p className="text-sm" style={{ color: "#8a7f72" }}>Aucune donnée de recherche</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topMotsCles.map(([mot, count]) => (
                <span
                  key={mot}
                  className="px-3 py-1.5 rounded text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                    fontSize: `${Math.min(11 + count * 2, 18)}px`,
                  }}
                >
                  {mot} <span className="opacity-60">({count})</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="carte-samr">
          <h3 className="text-lg font-bold text-primary mb-4">Sources consultées</h3>
          {topDomaines.length === 0 ? (
            <p className="text-sm" style={{ color: "#8a7f72" }}>Aucun site collecté</p>
          ) : (
            <div className="space-y-2">
              {topDomaines.map(([domain, count]) => (
                <div key={domain} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-primary">{domain}</span>
                  <span className="bg-accent-light text-accent px-2 py-0.5 rounded text-xs font-bold">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Classement élèves */}
      <div className="carte-samr">
        <h3 className="text-lg font-bold text-primary mb-4">Classement par engagement</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#d5cec4]">
              <th className="label-upper text-left py-2">Élève</th>
              <th className="label-upper text-center py-2">Réponses</th>
              <th className="label-upper text-center py-2">Sites</th>
              <th className="label-upper text-center py-2">Recherches</th>
              <th className="label-upper text-center py-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {reponses
              .map((r) => {
                const rech = recherches.find((rc) => rc.id === r.id);
                let nbReponses: number;
                let nbSites: number;

                if (r.questions) {
                  nbReponses = r.questions.filter((qd) => qd.reponse?.trim()).length;
                  nbSites = r.questions.reduce((acc, qd) => acc + (qd.sitesConsultes?.length || 0), 0);
                } else {
                  nbReponses = r.reponses?.filter((rep) => rep.reponse?.trim()).length || 0;
                  nbSites = r.liensCollectes?.length || 0;
                }

                const nbRech = rech?.parQuestion
                  ? rech.parQuestion.reduce((acc, pq) => acc + (pq.requetes?.length || 0), 0)
                  : (rech?.requetes?.length || 0);

                const score = nbReponses * 3 + nbSites * 2 + nbRech;
                return { ...r, nbReponses, nbSites, nbRech, score };
              })
              .sort((a, b) => b.score - a.score)
              .map((r, i) => (
                <tr key={r.id} className="border-b border-cream-dark">
                  <td className="py-3 font-medium">
                    <span className="text-accent font-bold mr-2">{i + 1}.</span>
                    {r.eleveNom || "Anonyme"}
                  </td>
                  <td className="text-center">{r.nbReponses}/{questionnaire.questions?.length || 0}</td>
                  <td className="text-center">{r.nbSites}</td>
                  <td className="text-center">{r.nbRech}</td>
                  <td className="text-center">
                    <span className="bg-primary text-white px-2 py-0.5 rounded text-xs font-bold">
                      {r.score}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
