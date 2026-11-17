import type { PreparationPreview } from "@/lib/preparation";
import { categoryMeta } from "./category-metadata";
import { Icon } from "./game-icon";

export function PublicPreparation({
  draft,
  hostName,
}: {
  draft: PreparationPreview | null;
  hostName: string;
}) {
  return (
    <section
      className="panel preparation preparation-preview"
      data-editable="false"
      aria-label="Preparação da partida, somente leitura"
    >
      <div className="preparation-title">
        <h2>Preparação da partida</h2>
        <span className="read-only-label">Só o organizador altera</span>
      </div>
      <p>
        {hostName} está preparando a partida. Acompanhe as escolhas por aqui.
      </p>
      {draft ? (
        <>
          <fieldset disabled className="public-preparation-fields">
            <div className="preparation-workspace">
              {" "}
              <fieldset className="preparation-categories">
                <legend>
                  Categorias ({draft.categories.length} de{" "}
                  {draft.categoryOptions.length} selecionadas)
                </legend>
                <div className="category-list">
                  {draft.categoryOptions.map((c) => (
                    <label
                      key={c}
                      className={`cat-card ${draft.categories.includes(c) ? "selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={draft.categories.includes(c)}
                        readOnly
                      />
                      <span className="cat-icon-3d" aria-hidden="true">
                        <Icon name={categoryMeta[c]?.icon ?? "bulb"} />
                      </span>
                      <span className="cat-info">
                        <strong>{c}</strong>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="preparation-settings">
                <h3>Ajustes da partida</h3>{" "}
                <div className="fields">
                  <label>
                    Rodadas
                    <input type="number" value={draft.rounds} readOnly />
                  </label>
                  <label>
                    Tamanho da pergunta
                    <select value={draft.words ?? ""} onChange={() => {}}>
                      <option value="">Todos os tamanhos</option>
                      {draft.words && (
                        <option value={draft.words}>
                          {draft.words} palavras
                        </option>
                      )}
                    </select>
                  </label>
                </div>
                <label>
                  Seleção
                  <select value={draft.mode} onChange={() => {}}>
                    <option value="automatic">Automática</option>
                    <option value="manual">Manual</option>
                    <option value="mixed">Mista</option>
                  </select>
                </label>
              </div>
            </div>
          </fieldset>
          <div className="prep-stats-bar">
            <span>{draft.availableCount} perguntas disponíveis</span>
            {draft.mode !== "automatic" && (
              <span>
                {draft.selectedCount}{" "}
                {draft.selectedCount === 1
                  ? "pergunta selecionada"
                  : "perguntas selecionadas"}
              </span>
            )}
          </div>
          <p className="public-preparation-note">
            As perguntas e respostas ficam com o organizador. A partida aparece
            aqui assim que ele iniciar.
          </p>
        </>
      ) : (
        <div className="preparation-wait" role="status">
          <span className="live-dot online" aria-hidden="true" /> Aguardando a
          configuração do organizador…
        </div>
      )}
    </section>
  );
}
