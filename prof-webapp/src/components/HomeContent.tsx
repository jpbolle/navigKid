"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getQuestionnaires,
  getReponses,
  deleteQuestionnaire,
  archiverQuestionnaire,
} from "@/lib/firebase";
import { formatDate, type Questionnaire } from "@/lib/types";

type QAvecReponses = Questionnaire & { nbReponses: number };

export default function HomeContent() {
  const [questionnaires, setQuestionnaires] = useState<QAvecReponses[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState("");
  const [onglet, setOnglet] = useState<"en-cours" | "archives">("en-cours");

  async function charger() {
    try {
      const qs = await getQuestionnaires();
      const avecReponses = await Promise.all(
        qs.map(async (q) => {
          const reponses = await getReponses(q.id);
          return { ...q, nbReponses: reponses.length };
        })
      );
      setQuestionnaires(avecReponses);
    } catch (err) {
      console.error(err);
      setErreur("Erreur de chargement. Vérifiez votre configuration Firebase.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  async function supprimer(id: string) {
    if (!confirm("Supprimer définitivement ce questionnaire et toutes ses réponses ?")) return;
    await deleteQuestionnaire(id);
    charger();
  }

  async function archiver(id: string, archive: boolean) {
    await archiverQuestionnaire(id, archive);
    charger();
  }

  const enCours = questionnaires.filter((q) => !q.archive);
  const archives = questionnaires.filter((q) => q.archive);
  const liste = onglet === "en-cours" ? enCours : archives;

  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-primary tracking-wide">Mes Questionnaires</h1>
        <div className="divider"><span>Navigation</span></div>
      </div>

      {/* Onglets + Bouton créer */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex border border-[#d5cec4] rounded overflow-hidden">
          <button
            onClick={() => setOnglet("en-cours")}
            className={`px-5 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-none transition-colors ${
              onglet === "en-cours"
                ? "bg-primary text-white"
                : "bg-cream text-[#8a7f72] hover:bg-cream-dark"
            }`}
          >
            En cours ({enCours.length})
          </button>
          <button
            onClick={() => setOnglet("archives")}
            className={`px-5 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-none transition-colors ${
              onglet === "archives"
                ? "bg-primary text-white"
                : "bg-cream text-[#8a7f72] hover:bg-cream-dark"
            }`}
          >
            Archives ({archives.length})
          </button>
        </div>
        <Link
          href="/create"
          className="bg-primary text-white px-5 py-2.5 rounded text-xs font-bold uppercase tracking-widest hover:bg-primary-dark transition-colors no-underline"
        >
          + Créer
        </Link>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-6 h-6 border-3 border-cream-dark border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {erreur && (
        <div className="bg-red-50 text-danger border border-red-200 rounded p-4 text-sm">
          {erreur}
        </div>
      )}

      {!loading && !erreur && liste.length === 0 && (
        <div className="carte-samr text-center py-12">
          <p className="text-base mb-2" style={{ color: "#8a7f72" }}>
            {onglet === "en-cours" ? "Aucun questionnaire en cours." : "Aucune archive."}
          </p>
          {onglet === "en-cours" && (
            <Link
              href="/create"
              className="bg-primary text-white px-5 py-2.5 rounded text-xs font-bold uppercase tracking-widest hover:bg-primary-dark transition-colors no-underline inline-block mt-3"
            >
              Créer mon premier questionnaire
            </Link>
          )}
        </div>
      )}

      <div className="space-y-4">
        {liste.map((q) => (
          <div key={q.id} className="carte-samr hover:shadow-md transition-shadow">
            {/* Titre + Actions icônes */}
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <h2 className="text-lg font-bold text-primary">{q.titre}</h2>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {q.theme.split(", ").map((t) => (
                    <span key={t} className="bg-primary-light text-primary px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">
                      {t}
                    </span>
                  ))}
                  <span className="bg-accent-light text-accent px-2.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest">
                    {q.codeAcces}
                  </span>
                </div>
              </div>
              {/* Icônes d'action */}
              <div className="flex gap-1 ml-3">
                <Link
                  href={`/create?edit=${q.id}`}
                  title="Modifier"
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-primary-light transition-colors no-underline text-base"
                >
                  ✏️
                </Link>
                <button
                  onClick={() => archiver(q.id, !q.archive)}
                  title={q.archive ? "Désarchiver" : "Archiver"}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-accent-light transition-colors border-none bg-transparent cursor-pointer text-base"
                >
                  📦
                </button>
                <button
                  onClick={() => supprimer(q.id)}
                  title="Supprimer"
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer text-base"
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Métadonnées */}
            <div className="flex gap-5 text-xs mb-3 label-upper">
              <span>{formatDate(q.creeLe)}</span>
              <span>{q.questions?.length || 0} questions</span>
              <span>{q.nbReponses} réponse(s)</span>
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-2">
              <Link
                href={`/results?id=${q.id}`}
                className="bg-primary text-white px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-primary-dark transition-colors no-underline"
              >
                Résultats
              </Link>
              <Link
                href={`/analyse?id=${q.id}`}
                className="bg-accent-light text-accent px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-accent/10 transition-colors no-underline border border-accent/30"
              >
                Analyser
              </Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
