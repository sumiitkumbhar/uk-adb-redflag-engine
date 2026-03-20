export type FactQuestion = {
  question: string
  type: "boolean" | "number" | "text"
}

export const factCatalog: Record<string, FactQuestion> = {

  isDwellingFlag: {
    question: "Is the building a dwellinghouse?",
    type: "boolean"
  },

  numberOfStaircases: {
    question: "How many staircases serve the building?",
    type: "number"
  },

  protectedShaftProvidedFlag: {
    question: "Is a protected shaft provided for vertical services?",
    type: "boolean"
  },

  reg7AppliesFlag: {
    question: "Does Regulation 7 (combustibility restriction) apply?",
    type: "boolean"
  },

  occupantLoad: {
    question: "What is the estimated occupant load?",
    type: "number"
  },

  spaceType: {
    question: "What type of space is being assessed?",
    type: "text"
  },

  hasFlats: {
    question: "Does the building contain flats?",
    type: "boolean"
  },

  basementHabitableRoomsFlag: {
    question: "Are there habitable rooms in the basement?",
    type: "boolean"
  },

  commonStairCount: {
    question: "How many common stairs are provided?",
    type: "number"
  }

}