"use client";

import { useState } from "react";
import { Badge, Button, Card, Field, ScoreChip, Status, Tile } from "@/components/ui";
import type { ButtonVariant, TileState } from "@/components/ui";
import s from "./page.module.css";

const variants: ButtonVariant[] = ["primary", "secondary", "brand", "success", "danger", "ghost"];
const swatches = [
  ["--palette-blue-500", "#087DF2 azul"],
  ["--palette-white", "#FFFFFF branco"],
  ["--palette-gold-400", "#FFBE3B dourado"],
  ["--palette-ink-900", "#102E53 ink"],
  ["--palette-blue-50", "#EAF6FF soft"],
  ["--palette-success-500", "#1BBC91 sucesso"],
  ["--palette-success-700", "#10765E sucesso texto"],
  ["--palette-danger-500", "#E95672 erro"],
  ["--palette-danger-700", "#B12647 erro texto"],
];
const words = ["galo", "bola", "campeonato", "Supercalifragilístico", "rei", "leão"];

export function Demo() {
  const [loading, setLoading] = useState(false);
  const [tiles, setTiles] = useState<TileState[]>(() =>
    Array.from({ length: 22 }, (_, i) => (i < 3 ? "revealed" : "hidden")),
  );
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <header>
          <Badge tone="highlight">Fase 1 · catálogo isolado</Badge>
          <h1 className={s.title}>Arriscaí! UI Foundation</h1>
          <p>Quanto menos pistas, mais pontos!</p>
        </header>

        <Card>
          <h2 className={s.h2}>Cores (primitivos)</h2>
          <div className={s.swatches}>
            {swatches.map(([v, label]) => (
              <div key={v} className={s.swatch}>
                <div style={{ background: `var(${v})` }} />
                <p>
                  {label}
                  <br />
                  <code>{v}</code>
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className={s.h2}>Tipografia</h2>
          <div className={s.type}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-display)", lineHeight: 1 }}>Display 22 pontos</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-heading-lg)" }}>Heading LG</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-heading-md)" }}>Heading MD</p>
            <p style={{ fontWeight: 900, fontSize: "var(--text-heading-sm)" }}>Heading SM — Nunito Sans 900</p>
            <p>Body — Em qual filme de animação um leão precisa recuperar seu lugar como rei?</p>
            <p style={{ fontSize: "var(--text-caption)", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em" }}>Caption</p>
          </div>
        </Card>

        <Card>
          <h2 className={s.h2}>Botões — normal / hover / foco (Tab) / pressed / disabled / loading</h2>
          {variants.map((v) => (
            <div key={v} className={s.row} style={{ marginBottom: "var(--space-4)" }}>
              <Button variant={v}>{v}</Button>
              <Button variant={v} data-pressed="true">pressed</Button>
              <Button variant={v} disabled>disabled</Button>
              <Button variant={v} loading>loading</Button>
              <Button variant={v} size="sm">sm</Button>
              <Button variant={v} size="lg">lg</Button>
            </div>
          ))}
          <Button
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            Criar uma sala (clique: loading)
          </Button>
        </Card>

        <div className={s.row} style={{ alignItems: "stretch" }}>
          <Card style={{ flex: "1 1 300px" }}>
            <h2 className={s.h2}>Campos</h2>
            <div className={s.stack}>
              <Field label="Como a turma te chama?" placeholder="Seu apelido" hint="Até 20 caracteres" />
              <Field label="Código da sala" placeholder="Ex.: A1B2C3D4" error="Sala não encontrada" defaultValue="ZZZ" />
              <Field label="Desabilitado" placeholder="—" disabled />
            </div>
          </Card>
          <Card style={{ flex: "1 1 300px" }}>
            <h2 className={s.h2}>Badges, status e placar</h2>
            <div className={s.row}>
              <Badge>Padrão</Badge>
              <Badge tone="highlight">Sua vez</Badge>
              <Badge tone="brand">Telão</Badge>
              <Badge tone="success">Online</Badge>
              <Badge tone="danger">Offline</Badge>
            </div>
            <div className={s.stack} style={{ marginTop: "var(--space-4)" }}>
              <Status>Uma palavra será revelada por vez.</Status>
              <Status tone="success" icon="✓">Acertou! +16 pontos</Status>
              <Status tone="danger" icon="!">Palpite incorreto.</Status>
              <Status tone="warning" icon="⏸">Partida pausada</Status>
            </div>
            <div className={s.row} style={{ marginTop: "var(--space-4)" }}>
              <ScoreChip name="Brunna" points={16} active />
              <ScoreChip name="Rafa" points={8} />
              <ScoreChip name="Léo" points={0} />
            </div>
          </Card>
        </div>

        <div className={s.row} style={{ alignItems: "stretch" }}>
          <Card style={{ flex: "1 1 260px" }}>
            <h2 className={s.h2}>Card padrão</h2>
            <p>Superfície branca, contorno ink, sombra tátil sólida.</p>
          </Card>
          <Card tone="subtle" style={{ flex: "1 1 260px" }}>
            <h2 className={s.h2}>Subtle</h2>
            <p>Agrupamentos secundários.</p>
          </Card>
          <Card tone="private" style={{ flex: "1 1 260px" }}>
            <h2 className={s.h2}>🔒 Privado (host)</h2>
            <p>Área exclusiva do organizador.</p>
          </Card>
          <Card tone="stage" style={{ flex: "1 1 260px" }}>
            <h2 className={s.h2}>Stage</h2>
            <p>Fundo de palco (telão).</p>
          </Card>
        </div>

        <Card>
          <h2 className={s.h2}>Tiles — oculto / selecionado / revelado / desabilitado (22 posições)</h2>
          <div className={s.board}>
            {tiles.map((st, i) => (
              <Tile
                key={i}
                position={i + 1}
                state={selected === i && st !== "revealed" ? "selected" : st}
                word={words[i % words.length]}
                disabled={st === "revealed" || i === 21}
                onClick={() => setSelected(i)}
              />
            ))}
          </div>
          <div className={s.row} style={{ marginTop: "var(--space-5)" }}>
            <Button
              variant="brand"
              disabled={selected === null}
              onClick={() => {
                if (selected === null) return;
                setTiles((t) => t.map((v, i) => (i === selected ? "revealed" : v)));
                setSelected(null);
              }}
            >
              Confirmar revelação
            </Button>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Cancelar
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
