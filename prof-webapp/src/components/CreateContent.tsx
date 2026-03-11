"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createQuestionnaire, getQuestionnaire, updateQuestionnaire } from "@/lib/firebase";
import type { Question } from "@/lib/types";

export default function CreateContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [titre, setTitre] = useState("");
  const [themes, setThemes] = useState<string[]>([]);
  const [themeInput, setThemeInput] = useState("");
  const [consignes, setConsignes] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [message, setMessage] = useState<{ type: "succes" | "erreur"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [codeAcces, setCodeAcces] = useState("");
  const [loading, setLoading] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const q = await getQuestionnaire(editId);
        if (q) {
          setTitre(q.titre);
          setThemes(q.theme ? q.theme.split(", ").filter(Boolean) : []);
          setConsignes(q.consignes || "");
          setQuestions(q.questions || []);
          setCodeAcces(q.codeAcces);
        } else {
          setMessage({ type: "erreur", text: "Questionnaire introuvable." });
        }
      } catch {
        setMessage({ type: "erreur", text: "Erreur lors du chargement du questionnaire." });
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  function ajouterQuestion(type: "texte" | "qcm") {
    const q: Question = type === "qcm"
      ? { texte: "", type: "qcm", options: ["", ""], correctes: [], nbSources: 1 }
      : { texte: "", type: "texte", nbSources: 1 };
    setQuestions([...questions, q]);
  }

  function updateQuestion(index: number, field: Partial<Question>) {
    const copy = [...questions];
    copy[index] = { ...copy[index], ...field };
    setQuestions(copy);
  }

  function supprimerQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index));
  }

  function deplacerQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const copy = [...questions];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setQuestions(copy);
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    const copy = [...questions];
    const opts = [...(copy[qIndex].options || [])];
    opts[oIndex] = value;
    copy[qIndex] = { ...copy[qIndex], options: opts };
    setQuestions(copy);
  }

  function ajouterOption(qIndex: number) {
    const copy = [...questions];
    copy[qIndex] = { ...copy[qIndex], options: [...(copy[qIndex].options || []), ""] };
    setQuestions(copy);
  }

  function supprimerOption(qIndex: number, oIndex: number) {
    const copy = [...questions];
    const opts = (copy[qIndex].options || []).filter((_, i) => i !== oIndex);
    if (opts.length >= 2) {
      const correctes = (copy[qIndex].correctes || [])
        .filter((c) => c !== oIndex)
        .map((c) => (c > oIndex ? c - 1 : c));
      copy[qIndex] = { ...copy[qIndex], options: opts, correctes };
      setQuestions(copy);
    }
  }

  function toggleCorrecte(qIndex: number, oIndex: number) {
    const copy = [...questions];
    const correctes = [...(copy[qIndex].correctes || [])];
    const idx = correctes.indexOf(oIndex);
    if (idx >= 0) {
      correctes.splice(idx, 1);
    } else {
      correctes.push(oIndex);
    }
    copy[qIndex] = { ...copy[qIndex], correctes };
    setQuestions(copy);
  }

  function ajouterTheme() {
    const t = themeInput.trim();
    if (t && !themes.includes(t)) {
      setThemes([...themes, t]);
    }
    setThemeInput("");
  }

  function supprimerTheme(index: number) {
    setThemes(themes.filter((_, i) => i !== index));
  }

  const [generating, setGenerating] = useState(false);

  async function genererSuggestionsIA() {
    if (themes.length === 0) {
      alert("Ajoutez d'abord au moins un thème pour générer des suggestions.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/generer-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themes, titre }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Erreur lors de la génération.");
        return;
      }
      setQuestions([...questions, ...data.questions]);
    } catch {
      alert("Erreur réseau lors de la génération.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const questionsValides = questions.filter((q) => q.texte.trim());
    if (questionsValides.length === 0) {
      setMessage({ type: "erreur", text: "Ajoutez au moins une question." });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        titre: titre.trim(),
        theme: themes.join(", "),
        consignes: consignes.trim(),
        questions: questionsValides,
      };
      if (editId) {
        await updateQuestionnaire(editId, payload);
        setMessage({ type: "succes", text: "Questionnaire mis à jour !" });
      } else {
        const result = await createQuestionnaire(payload);
        setCodeAcces(result.codeAcces);
        setMessage({ type: "succes", text: `Questionnaire créé ! Code d'accès : ${result.codeAcces}` });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "erreur", text: "Erreur lors de la sauvegarde." });
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full px-4 py-3 border-1.5 border-[#d5cec4] rounded bg-white text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary tracking-wide">
          {editId ? "Modifier le questionnaire" : "Créer un questionnaire"}
        </h1>
        <div className="divider"><span>{editId ? "Modification" : "Nouveau"}</span></div>
        <p className="text-sm" style={{ color: "#8a7f72" }}>
          Chaque question comporte deux parties : (A) collecter des sources web, (B) répondre en s&apos;appuyant sur les extraits soulignés.
        </p>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-6 h-6 border-3 border-cream-dark border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!loading && <form onSubmit={handleSubmit}>
        {/* Infos générales */}
        <div className="carte-samr mb-5">
          <div className="mb-5">
            <label className="label-upper block mb-2">Titre du questionnaire</label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Les énergies renouvelables"
              required
              className={inputClass}
            />
          </div>
          <div className="mb-5 border-l-3 border-l-primary pl-4">
            <label className="label-upper block mb-2">Thèmes</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={themeInput}
                onChange={(e) => setThemeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); ajouterTheme(); }
                }}
                placeholder="Ex: Sciences, Environnement... (Entrée pour ajouter)"
                className={inputClass}
              />
              <button
                type="button"
                onClick={ajouterTheme}
                className="bg-primary text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider cursor-pointer border-none whitespace-nowrap hover:bg-primary-dark transition-colors"
              >
                +
              </button>
            </div>
            {themes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {themes.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 bg-primary-light text-primary px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => supprimerTheme(i)}
                      className="text-primary/50 hover:text-danger border-none bg-transparent cursor-pointer text-sm leading-none"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="label-upper block mb-2">Consignes pour les élèves</label>
            <textarea
              value={consignes}
              onChange={(e) => setConsignes(e.target.value)}
              placeholder="Ex: Pour chaque question, collectez les sources demandées puis surlignez les passages pertinents avant de répondre."
              rows={3}
              className={inputClass + " resize-y"}
            />
          </div>
        </div>

        {/* Questions — Tableau */}
        <div className="carte-samr mb-5">
          <h3 className="text-lg font-bold text-primary mb-4">Questions</h3>

          {questions.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "#8a7f72" }}>
              Aucune question ajoutée. Chaque question demande à l&apos;élève de collecter des sources web puis de répondre.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#d5cec4]">
                    <th className="label-upper text-center py-2 px-2 w-16">#</th>
                    <th className="label-upper text-left py-2 px-2">Énoncé de la question</th>
                    <th className="label-upper text-center py-2 px-2 w-20">Type</th>
                    <th className="label-upper text-center py-2 px-2 w-24">Sources</th>
                    <th className="label-upper text-center py-2 px-2 w-16">Points</th>
                    <th className="label-upper text-center py-2 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <tr key={i} className="border-b border-cream-dark align-top group">
                      <td className="py-3 px-2 text-center">
                        <span className="font-bold text-accent">{i + 1}</span>
                        <div className="flex flex-col items-center gap-0.5 mt-1">
                          <button
                            type="button"
                            onClick={() => deplacerQuestion(i, -1)}
                            disabled={i === 0}
                            className="w-6 h-5 flex items-center justify-center rounded border border-[#d5cec4] bg-white hover:bg-primary-light text-[10px] text-[#8a7f72] hover:text-primary cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            title="Monter"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => deplacerQuestion(i, 1)}
                            disabled={i === questions.length - 1}
                            className="w-6 h-5 flex items-center justify-center rounded border border-[#d5cec4] bg-white hover:bg-primary-light text-[10px] text-[#8a7f72] hover:text-primary cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            title="Descendre"
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <textarea
                          value={q.texte}
                          onChange={(e) => updateQuestion(i, { texte: e.target.value })}
                          placeholder="Ex: Trouvez un article sur... puis expliquez..."
                          rows={4}
                          className="w-full px-3 py-2 border border-[#d5cec4] rounded text-sm focus:outline-none focus:border-primary resize-y"
                        />
                        {/* Options QCM */}
                        {q.type === "qcm" && q.options && (
                          <div className="mt-2 space-y-1.5">
                            <p className="text-[10px] text-[#8a7f72] italic mb-1">Cliquez sur une option pour la marquer comme bonne réponse</p>
                            {q.options.map((opt, j) => {
                              const estCorrecte = (q.correctes || []).includes(j);
                              return (
                                <div
                                  key={j}
                                  className={`flex gap-2 items-center rounded px-1.5 py-0.5 cursor-pointer transition-colors ${
                                    estCorrecte
                                      ? "border-l-3 border-l-green-500 bg-green-50"
                                      : "border-l-3 border-l-transparent"
                                  }`}
                                  onClick={() => toggleCorrecte(i, j)}
                                >
                                  <span className={`text-xs font-bold w-5 ${estCorrecte ? "text-green-600" : "text-accent"}`}>
                                    {estCorrecte ? "✓" : String.fromCharCode(65 + j) + "."}
                                  </span>
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => { e.stopPropagation(); updateOption(i, j, e.target.value); }}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder={`Option ${String.fromCharCode(65 + j)}`}
                                    className={`flex-1 px-2 py-1.5 border rounded text-xs focus:outline-none focus:border-primary ${
                                      estCorrecte ? "border-green-300 bg-white" : "border-[#d5cec4]"
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); supprimerOption(i, j); }}
                                    className="text-[#8a7f72] hover:text-danger border-none bg-transparent cursor-pointer text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => ajouterOption(i)}
                              className="text-xs text-primary hover:text-primary-dark cursor-pointer border-none bg-transparent font-semibold"
                            >
                              + Option
                            </button>
                          </div>
                        )}
                        {/* Feedback prof (réponse attendue + références) */}
                        <details className="mt-2">
                          <summary className="text-[10px] text-accent font-bold uppercase tracking-wider cursor-pointer hover:text-primary">
                            Corrigé & références
                          </summary>
                          <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded text-xs space-y-2">
                            <div>
                              <span className="font-bold text-amber-700">Réponse attendue :</span>
                              <textarea
                                value={q.reponseAttendue || ""}
                                onChange={(e) => updateQuestion(i, { reponseAttendue: e.target.value })}
                                placeholder="Éléments de réponse attendus, points clés..."
                                rows={2}
                                className="w-full mt-1 px-2 py-1.5 border border-amber-200 rounded text-xs focus:outline-none focus:border-primary resize-y bg-white"
                              />
                            </div>
                            <div>
                              <span className="font-bold text-amber-700">Références :</span>
                              {(q.referencesProf || []).map((url, ri) => (
                                <div key={ri} className="flex gap-1 items-center mt-1">
                                  <span className="text-amber-500">→</span>
                                  <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => {
                                      const refs = [...(q.referencesProf || [])];
                                      refs[ri] = e.target.value;
                                      updateQuestion(i, { referencesProf: refs });
                                    }}
                                    placeholder="https://..."
                                    className="flex-1 px-2 py-1 border border-amber-200 rounded text-xs focus:outline-none focus:border-primary bg-white"
                                  />
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-dark text-xs">↗</a>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const refs = (q.referencesProf || []).filter((_, k) => k !== ri);
                                      updateQuestion(i, { referencesProf: refs });
                                    }}
                                    className="text-[#8a7f72] hover:text-danger border-none bg-transparent cursor-pointer text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => {
                                  const refs = [...(q.referencesProf || []), ""];
                                  updateQuestion(i, { referencesProf: refs });
                                }}
                                className="text-xs text-primary hover:text-primary-dark cursor-pointer border-none bg-transparent font-semibold mt-1"
                              >
                                + Ajouter une référence
                              </button>
                            </div>
                          </div>
                        </details>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <select
                          value={q.type}
                          onChange={(e) => {
                            const newType = e.target.value as "texte" | "qcm";
                            const update: Partial<Question> = { type: newType };
                            if (newType === "qcm" && !q.options) {
                              update.options = ["", ""];
                              update.correctes = [];
                            }
                            updateQuestion(i, update);
                          }}
                          className="px-2 py-1.5 border border-[#d5cec4] rounded text-xs bg-white focus:outline-none focus:border-primary cursor-pointer"
                        >
                          <option value="texte">Texte</option>
                          <option value="qcm">QCM</option>
                        </select>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <select
                          value={q.nbSources}
                          onChange={(e) => updateQuestion(i, { nbSources: parseInt(e.target.value) })}
                          className="px-2 py-1.5 border border-[#d5cec4] rounded text-xs bg-white focus:outline-none focus:border-primary cursor-pointer w-16"
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>{n} source{n > 1 ? "s" : ""}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <input
                          type="number"
                          value={q.points || ""}
                          onChange={(e) => updateQuestion(i, { points: e.target.value ? parseInt(e.target.value) : undefined })}
                          placeholder="—"
                          min={0}
                          className="w-14 px-1 py-1.5 border border-[#d5cec4] rounded text-xs text-center bg-white focus:outline-none focus:border-primary"
                        />
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => supprimerQuestion(i)}
                          className="text-[#8a7f72] hover:text-danger hover:bg-red-50 rounded p-1 border-none bg-transparent cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Total points + Légende */}
          {questions.length > 0 && (
            <>
              <div className="mt-4 flex justify-between items-center">
                <div className="flex gap-6 text-xs" style={{ color: "#8a7f72" }}>
                  <span><strong>Type</strong> : Texte = réponse ouverte (corrigée par IA), QCM = correction auto</span>
                  <span><strong>Sources</strong> : nombre de pages web/PDF à collecter</span>
                </div>
                <div className="text-sm font-bold text-primary">
                  Total : {questions.reduce((sum, q) => sum + (q.points || 0), 0)} pts
                </div>
              </div>
            </>
          )}

          {/* Boutons ajouter question */}
          <div className="flex gap-2 mt-4 justify-center">
            <button
              type="button"
              onClick={() => ajouterQuestion("texte")}
              className="bg-primary-light text-primary px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer border-none transition-colors hover:bg-primary/10"
            >
              + Texte libre
            </button>
            <button
              type="button"
              onClick={() => ajouterQuestion("qcm")}
              className="bg-primary-light text-primary px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer border-none transition-colors hover:bg-primary/10"
            >
              + QCM
            </button>
            <button
              type="button"
              onClick={genererSuggestionsIA}
              disabled={generating}
              className="bg-accent text-white px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer border-none transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? "Génération..." : "Générer IA"}
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`rounded p-4 text-sm mb-4 ${
              message.type === "succes"
                ? "bg-primary-light text-primary border border-primary/20"
                : "bg-red-50 text-danger border border-red-200"
            }`}
          >
            {message.text}
            {codeAcces && (
              <>
                {" — "}
                <Link href="/" className="underline font-semibold">
                  Retour à l&apos;accueil
                </Link>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Link
            href="/"
            className="bg-cream-dark text-[#8a7f72] px-5 py-2.5 rounded text-xs font-bold uppercase tracking-widest no-underline border border-[#d5cec4] transition-colors hover:bg-[#d5cec4]"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-white px-5 py-2.5 rounded text-xs font-bold uppercase tracking-widest hover:bg-primary-dark disabled:bg-[#8a7f72] cursor-pointer disabled:cursor-not-allowed border-none transition-colors"
          >
            {saving ? "Sauvegarde..." : editId ? "Mettre à jour" : "Sauvegarder le questionnaire"}
          </button>
        </div>
      </form>}
    </>
  );
}
