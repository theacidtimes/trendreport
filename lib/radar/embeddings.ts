const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings'
const MODEL = 'voyage-3'

type InputType = 'document' | 'query'

async function embed(texts: string[], inputType: InputType): Promise<number[][]> {
  if (texts.length === 0) return []

  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY!}`
    },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: inputType })
  })

  if (!res.ok) {
    throw new Error(`[VOYAGE] ${res.status}: ${await res.text()}`)
  }

  const json = await res.json()
  return json.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((d: { embedding: number[] }) => d.embedding)
}

// Sinais a serem armazenados na memória do cliente.
export function embedDocuments(texts: string[]): Promise<number[][]> {
  return embed(texts, 'document')
}

// Consulta para recuperar memória histórica relevante.
export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embed([text], 'query')
  return vec
}
