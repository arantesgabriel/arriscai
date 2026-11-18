// Administrative helper. Texts are supplied privately by the caller, never bundled.
export async function correctCatalogQuestion(db, patch) {
  const { id, category, previousQuestion, question, answer, aliases } = patch;
  if (
    !id ||
    !category ||
    !previousQuestion ||
    !question ||
    !answer ||
    !Array.isArray(aliases)
  )
    throw new Error("Correção editorial incompleta.");
  return db.query(
    `update private.questions set question=$1
     where id=$2 and owner_id is null and category=$3
       and question=$4 and answer=$5 and aliases=$6::jsonb
     returning id`,
    [question, id, category, previousQuestion, answer, JSON.stringify(aliases)],
  );
}
