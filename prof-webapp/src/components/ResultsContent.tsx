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
  formatDate,
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

export default function ResultsContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [reponses, setReponses] = useState<Reponse[]>([]);
  const [recherches, setRecherches] = useState<Record<string, Recherche>>({});
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
        const map: Record<string, Recherche> = {};
        rech.forEach((r) => { map[r.id] = r; });
        setRecherches(map);
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

  // Compter les sites/liens total (rétrocompatible)
  const totalSites = reponses.reduce((s, r) => {
    if (r.questions) {
      return s + r.questions.reduce((acc, q) => acc + (q.sitesConsultes?.length || 0), 0);
    }
    return s + (r.liensCollectes?.length || 0);
  }, 0);
  const moyenneSites = reponses.length > 0 ? (totalSites / reponses.length).toFixed(1) : "0";

  return (
    <>
      {/* En-tête */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary tracking-wide">{questionnaire.titre}</h1>
        <div className="divider"><span>Résultats</span></div>
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
          href={`/analyse?id=${id}`}
          className="bg-accent text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-widest no-underline hover:bg-accent/90 transition-colors"
        >
          Voir l&apos;analyse
        </Link>
        <Link
          href="/"
          className="bg-cream-dark text-[#8a7f72] px-4 py-2 rounded text-xs font-bold uppercase tracking-widest no-underline border border-[#d5cec4] hover:bg-[#d5cec4] transition-colors"
        >
          Retour
        </Link>
      </div>

      {questionnaire.consignes && (
        <p className="text-sm mb-6" style={{ color: "#8a7f72" }}>{questionnaire.consignes}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { val: reponses.length, label: "Réponses reçues" },
          { val: questionnaire.questions?.length || 0, label: "Questions" },
          { val: totalSites, label: "Sites collectés" },
          { val: moyenneSites, label: "Sites / élève" },
        ].map((s) => (
          <div key={s.label} className="carte-samr text-center">
            <div className="text-3xl font-black text-primary" style={{ fontFamily: "var(--font-display)" }}>
              {s.val}
            </div>
            <div className="label-upper mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Réponses */}
      <div className="divider mb-6"><span>Réponses des élèves</span></div>

      {reponses.length === 0 && (
        <div className="carte-samr text-center py-12">
          <p className="text-base" style={{ color: "#8a7f72" }}>Aucune réponse reçue pour le moment.</p>
          <p className="text-xs mt-2" style={{ color: "#8a7f72" }}>Partagez le code d&apos;accès avec vos élèves.</p>
        </div>
      )}

      <div className="space-y-5">
        {reponses.map((r) => {
          const rech = recherches[r.id];
          const isNewFormat = !!r.questions;

          return (
            <div key={r.id} className="carte-samr">
              <h3 className="text-lg font-bold text-primary mb-3 flex items-center gap-2">
                {r.eleveNom || "Élève anonyme"}
                <span className="label-upper font-normal">{formatDate(r.soumisLe)}</span>
              </h3>

              {/* Réponses par question */}
              <div className="mb-5">
                <h4 className="label-upper mb-3">Réponses</h4>
                {isNewFormat ? (
                  // Nouveau format : questions[] avec tracking intégré
                  (r.questions || []).map((qData) => {
                    const qTexte = questionnaire.questions?.[qData.questionIndex]?.texte || `Question ${qData.questionIndex + 1}`;
                    return (
                      <div key={qData.questionIndex} className="mb-4">
                        <div className="text-sm font-semibold text-primary-dark">
                          {qData.questionIndex + 1}. {qTexte}
                        </div>
                        <div className="bg-cream rounded px-3 py-2 text-sm mt-1 border border-[#d5cec4]">
                          {qData.reponse || "—"}
                        </div>

                        {/* Mots-clés pour cette question */}
                        {qData.motsCles?.length > 0 && (
                          <div className="mt-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a7f72]">Mots-clés : </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {qData.motsCles.map((mc, i) => (
                                <span key={i} className="bg-primary-light text-primary px-2 py-0.5 rounded text-[11px] font-semibold">
                                  {mc.texte}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sites pour cette question */}
                        {qData.sitesConsultes?.length > 0 && (
                          <div className="mt-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a7f72]">
                              Sites ({qData.sitesConsultes.length}) :
                            </span>
                            <div className="space-y-1.5 mt-1">
                              {qData.sitesConsultes.map((site, i) => (
                                <div key={i} className="bg-cream rounded px-3 py-2 text-sm border border-[#d5cec4]">
                                  <a
                                    href={site.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline break-all font-medium text-xs"
                                  >
                                    {site.titre || site.url}
                                  </a>
                                  <div className="flex gap-3 mt-1 text-[10px] text-[#8a7f72]">
                                    {site.pertinence && <span className="text-primary font-semibold">Pertinent</span>}
                                    {site.fiabilite > 0 && <span>Fiabilité : {site.fiabilite}/5</span>}
                                    {site.tempsPasse > 0 && <span>{formatTemps(site.tempsPasse)}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Passages soulignés pour cette question */}
                        {(qData.passages ?? []).length > 0 && (
                          <div className="mt-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a7f72]">
                              Passages soulignés ({(qData.passages ?? []).length}) :
                            </span>
                            <div className="space-y-1.5 mt-1">
                              {(qData.passages ?? []).map((p, i) => (
                                <div key={i} className="bg-cream rounded px-3 py-2 text-sm border border-[#d5cec4] flex items-start gap-2">
                                  <span
                                    className="inline-block w-2 min-h-[16px] rounded-sm flex-shrink-0 mt-0.5"
                                    style={{ backgroundColor: p.couleur }}
                                  />
                                  <div className="min-w-0">
                                    <div className="text-xs italic text-[#3d3832]">&ldquo;{p.texte}&rdquo;</div>
                                    <div className="text-[10px] text-[#d4944c] mt-0.5">
                                      {(() => { try { return new URL(p.url).hostname; } catch { return p.url; } })()}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  // Ancien format : reponses[] + liensCollectes[]
                  (r.reponses || []).map((rep) => {
                    const qTexte = questionnaire.questions?.[rep.questionIndex]?.texte || `Question ${rep.questionIndex + 1}`;
                    return (
                      <div key={rep.questionIndex} className="mb-3">
                        <div className="text-sm font-semibold text-primary-dark">
                          {rep.questionIndex + 1}. {qTexte}
                        </div>
                        <div className="bg-cream rounded px-3 py-2 text-sm mt-1 border border-[#d5cec4]">
                          {rep.reponse || "—"}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Liens (ancien format uniquement) */}
              {!isNewFormat && (
                <div className="mb-5">
                  <h4 className="label-upper mb-3">
                    Liens collectés ({r.liensCollectes?.length || 0})
                  </h4>
                  {(r.liensCollectes || []).length === 0 ? (
                    <p className="text-sm" style={{ color: "#8a7f72" }}>Aucun lien collecté</p>
                  ) : (
                    <div className="space-y-2">
                      {(r.liensCollectes || []).map((l, i) => (
                        <div key={i} className="bg-cream rounded px-3 py-2 text-sm border border-[#d5cec4]">
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline break-all font-medium"
                          >
                            {l.titre || l.url}
                          </a>
                          {l.commentaire && (
                            <div className="text-xs italic mt-0.5" style={{ color: "#8a7f72" }}>
                              &quot;{l.commentaire}&quot;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Recherches */}
              <div>
                <h4 className="label-upper mb-3">Mots-clés recherchés</h4>
                {rech?.parQuestion ? (
                  // Nouveau format recherches
                  <div className="flex flex-wrap gap-2">
                    {rech.parQuestion.flatMap((pq) => pq.requetes || []).map((req, i) => (
                      <span
                        key={i}
                        className="bg-primary-light text-primary px-3 py-1 rounded text-xs font-semibold"
                      >
                        {req.texte}
                      </span>
                    ))}
                  </div>
                ) : rech?.requetes?.length ? (
                  // Ancien format recherches
                  <div className="flex flex-wrap gap-2">
                    {rech.requetes.map((req, i) => (
                      <span
                        key={i}
                        className="bg-primary-light text-primary px-3 py-1 rounded text-xs font-semibold"
                      >
                        {req.texte}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: "#8a7f72" }}>Aucune donnée de recherche</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
