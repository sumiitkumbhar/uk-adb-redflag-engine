import readline from "readline"
import { factCatalog } from "./factCatalog"

export async function askQuestion(factKey: string): Promise<any> {

  const fact = factCatalog[factKey]

  if (!fact) return undefined

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const answer: string = await new Promise(resolve => {
    rl.question(`${fact.question}: `, resolve)
  })

  rl.close()

  if (fact.type === "boolean") {
    return answer.toLowerCase() === "yes" || answer === "true"
  }

  if (fact.type === "number") {
    return Number(answer)
  }

  return answer
}