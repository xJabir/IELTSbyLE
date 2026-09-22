/* =========================================================
   IELTS GRAMMAR & SENTENCE BUILDER — DATA
   Each grammar point: title, category, explanation, structure,
   example (correct model sentence), commonError {wrong, right},
   skills[] ('listening'|'reading'|'writing'|'speaking'),
   difficulty, tip, related[]
   ========================================================= */

const GRAMMAR_DATA = [

  // ---------- Tenses ----------
  { title: 'Present Simple for facts & routines', category: 'Tenses', explanation: 'Used for permanent facts, habits, and routines.', structure: 'Subject + base verb (+s/es)', example: 'Water boils at 100 degrees Celsius.', commonError: { wrong: 'Water is boiling at 100 degrees.', right: 'Water boils at 100 degrees.' }, skills: ['writing','speaking'], difficulty: 'beginner', tip: 'Use this for Task 1 process descriptions and general truths in Task 2.', related: ['Present Continuous for temporary situations','Present Perfect for experience'] },
  { title: 'Present Continuous for temporary situations', category: 'Tenses', explanation: 'Used for actions happening now or temporary trends.', structure: 'Subject + am/is/are + verb-ing', example: 'More people are choosing to work from home these days.', commonError: { wrong: 'More people choose to work from home these days.', right: 'More people are choosing to work from home these days.' }, skills: ['writing','speaking'], difficulty: 'beginner', tip: '"These days" and "nowadays" often signal Present Continuous, not Present Simple.', related: ['Present Simple for facts & routines'] },
  { title: 'Present Perfect for experience', category: 'Tenses', explanation: 'Links the past to the present — used for life experience or change up to now.', structure: 'Subject + have/has + past participle', example: 'The city has changed dramatically over the last decade.', commonError: { wrong: 'The city changed dramatically over the last decade.', right: 'The city has changed dramatically over the last decade.' }, skills: ['writing','speaking'], difficulty: 'intermediate', tip: 'Use with "over the last/past + time period" to describe ongoing change — very common in Task 1.', related: ['Past Simple for finished actions','Present Perfect Continuous'] },
  { title: 'Past Simple for finished actions', category: 'Tenses', explanation: 'Used for actions completed at a specific time in the past.', structure: 'Subject + past form of verb', example: 'Sales rose sharply in March before falling again in April.', commonError: { wrong: 'Sales rise sharply in March.', right: 'Sales rose sharply in March.' }, skills: ['writing','listening'], difficulty: 'beginner', tip: 'Essential for describing a specific point on a Task 1 graph.', related: ['Present Perfect for experience'] },
  { title: 'Present Perfect Continuous', category: 'Tenses', explanation: 'Emphasises the duration of an action that started in the past and continues now.', structure: 'Subject + have/has + been + verb-ing', example: 'Governments have been investing heavily in renewable energy.', commonError: { wrong: 'Governments have invested heavily in renewable energy since 2010 continuously.', right: 'Governments have been investing heavily in renewable energy since 2010.' }, skills: ['writing','speaking'], difficulty: 'advanced', tip: 'Use with "for" and "since" to stress an ongoing process, not just a result.', related: ['Present Perfect for experience'] },
  { title: 'Future forms: will vs going to', category: 'Tenses', explanation: '"Will" is for predictions and decisions made now; "going to" is for plans already decided.', structure: 'will + base verb / am,is,are + going to + base verb', example: 'If current trends continue, demand will double by 2030.', commonError: { wrong: 'If current trends continue, demand is going to double by 2030 based on this plan.', right: 'If current trends continue, demand will double by 2030.' }, skills: ['writing','speaking'], difficulty: 'intermediate', tip: 'Use "will" for graph predictions and general future trends in Task 1 and Task 2.', related: ['Zero Conditional','First Conditional'] },

  // ---------- Conditionals ----------
  { title: 'Zero Conditional', category: 'Conditionals', explanation: 'Used for facts and things that are always true.', structure: 'If + present simple, present simple', example: 'If prices rise, demand usually falls.', commonError: { wrong: 'If prices will rise, demand usually falls.', right: 'If prices rise, demand usually falls.' }, skills: ['writing','speaking'], difficulty: 'beginner', tip: 'Never use "will" in the if-clause of a zero conditional.', related: ['First Conditional'] },
  { title: 'First Conditional', category: 'Conditionals', explanation: 'Used for realistic or likely future situations.', structure: 'If + present simple, will + base verb', example: 'If governments invest more in public transport, congestion will decrease.', commonError: { wrong: 'If governments will invest more in public transport, congestion will decrease.', right: 'If governments invest more in public transport, congestion will decrease.' }, skills: ['writing','speaking'], difficulty: 'beginner', tip: 'A very useful structure for Task 2 solution paragraphs.', related: ['Zero Conditional','Second Conditional'] },
  { title: 'Second Conditional', category: 'Conditionals', explanation: 'Used for unlikely, hypothetical, or imaginary present/future situations.', structure: 'If + past simple, would + base verb', example: 'If more people cycled to work, air quality would improve significantly.', commonError: { wrong: 'If more people cycled to work, air quality will improve significantly.', right: 'If more people cycled to work, air quality would improve significantly.' }, skills: ['writing','speaking'], difficulty: 'intermediate', tip: 'Great for discussing hypothetical policy changes in Task 2.', related: ['First Conditional','Third Conditional'] },
  { title: 'Third Conditional', category: 'Conditionals', explanation: 'Used to imagine a different outcome for something that already happened.', structure: 'If + past perfect, would have + past participle', example: 'If the factory had installed filters earlier, pollution levels would have been lower.', commonError: { wrong: 'If the factory installed filters earlier, pollution levels would have been lower.', right: 'If the factory had installed filters earlier, pollution levels would have been lower.' }, skills: ['writing'], difficulty: 'advanced', tip: 'Useful for evaluating past decisions, though less common in Task 2 than 1st/2nd conditional.', related: ['Second Conditional'] },
  { title: 'Mixed Conditional', category: 'Conditionals', explanation: 'Combines a past condition with a present result, or vice versa.', structure: 'If + past perfect, would + base verb', example: 'If the city had built more housing, rents would not be so high today.', commonError: { wrong: 'If the city built more housing, rents would not have been so high today.', right: 'If the city had built more housing, rents would not be so high today.' }, skills: ['writing'], difficulty: 'advanced', tip: 'Shows sophisticated control of tenses — useful for a Band 7+ Task 2 essay.', related: ['Third Conditional','Second Conditional'] },

  // ---------- Passive Voice ----------
  { title: 'Passive Voice: present', category: 'Passive Voice', explanation: 'Used when the action or process matters more than who does it.', structure: 'Subject + am/is/are + past participle', example: 'The raw materials are transported to the factory by truck.', commonError: { wrong: 'The raw materials transported to the factory by truck.', right: 'The raw materials are transported to the factory by truck.' }, skills: ['writing'], difficulty: 'intermediate', tip: 'Essential for Task 1 process diagrams, where the focus is on the process, not the person.', related: ['Passive Voice: past'] },
  { title: 'Passive Voice: past', category: 'Passive Voice', explanation: 'Used to describe a completed process or historical fact where the agent is unknown or unimportant.', structure: 'Subject + was/were + past participle', example: 'The bridge was completed in 1932 after four years of construction.', commonError: { wrong: 'The bridge completed in 1932.', right: 'The bridge was completed in 1932.' }, skills: ['writing','reading'], difficulty: 'intermediate', tip: 'Common in Reading passages describing history — recognise it to answer questions accurately.', related: ['Passive Voice: present'] },
  { title: 'Passive with modals', category: 'Passive Voice', explanation: 'Used to express necessity, ability or possibility about a process.', structure: 'Modal + be + past participle', example: 'The data must be verified before it can be published.', commonError: { wrong: 'The data must verified before it can publish.', right: 'The data must be verified before it can be published.' }, skills: ['writing'], difficulty: 'advanced', tip: 'Useful for Task 2 recommendations: "more should be done", "action must be taken".', related: ['Passive Voice: present'] },

  // ---------- Relative Clauses ----------
  { title: 'Defining relative clauses', category: 'Relative Clauses', explanation: 'Give essential information about the noun, with no commas.', structure: '..., who/which/that + clause', example: 'Students who study consistently tend to perform better in exams.', commonError: { wrong: 'Students, who study consistently, tend to perform better in exams incorrectly punctuated.', right: 'Students who study consistently tend to perform better in exams.' }, skills: ['writing','speaking'], difficulty: 'intermediate', tip: 'No commas — the clause is essential to identify which students you mean.', related: ['Non-defining relative clauses'] },
  { title: 'Non-defining relative clauses', category: 'Relative Clauses', explanation: 'Add extra, non-essential information, separated by commas.', structure: 'Noun, which/who + clause,', example: 'The Amazon rainforest, which covers much of Brazil, is often called the planet\'s lungs.', commonError: { wrong: 'The Amazon rainforest which covers much of Brazil is often called the planet\'s lungs.', right: 'The Amazon rainforest, which covers much of Brazil, is often called the planet\'s lungs.' }, skills: ['writing'], difficulty: 'advanced', tip: 'Always use commas, and never use "that" in a non-defining clause.', related: ['Defining relative clauses'] },
  { title: 'Reduced relative clauses', category: 'Relative Clauses', explanation: 'A shorter way to add information by dropping the relative pronoun and verb "be".', structure: 'Noun + past/present participle clause', example: 'Policies aimed at reducing emissions have gained public support.', commonError: { wrong: 'Policies aim at reducing emissions have gained public support.', right: 'Policies aimed at reducing emissions have gained public support.' }, skills: ['writing'], difficulty: 'advanced', tip: 'A concise, natural way to add detail without lengthening a sentence too much.', related: ['Defining relative clauses'] },

  // ---------- Comparatives & Superlatives ----------
  { title: 'Comparative adjectives', category: 'Comparatives & Superlatives', explanation: 'Used to compare two things.', structure: 'adjective + -er / more + adjective + than', example: 'Public transport is more efficient than private cars in busy cities.', commonError: { wrong: 'Public transport is more efficient than private cars in busy cities than.', right: 'Public transport is more efficient than private cars in busy cities.' }, skills: ['writing','speaking'], difficulty: 'beginner', tip: 'Use "more + adjective" for adjectives with 2+ syllables; "-er" for short ones.', related: ['Superlative adjectives'] },
  { title: 'Superlative adjectives', category: 'Comparatives & Superlatives', explanation: 'Used to compare three or more things and identify the extreme.', structure: 'the + adjective + -est / the most + adjective', example: 'Tokyo is one of the most densely populated cities in the world.', commonError: { wrong: 'Tokyo is one of the most densely populated city in the world.', right: 'Tokyo is one of the most densely populated cities in the world.' }, skills: ['writing','speaking'], difficulty: 'beginner', tip: '"One of the + superlative + plural noun" is a very natural, flexible IELTS phrase.', related: ['Comparative adjectives'] },
  { title: 'Double comparatives', category: 'Comparatives & Superlatives', explanation: 'Shows that as one thing changes, another changes with it.', structure: 'The + comparative..., the + comparative...', example: 'The more cities invest in cycling infrastructure, the fewer cars are on the road.', commonError: { wrong: 'More cities invest in cycling infrastructure, fewer cars are on the road.', right: 'The more cities invest in cycling infrastructure, the fewer cars are on the road.' }, skills: ['writing','speaking'], difficulty: 'advanced', tip: 'A great structure to show cause-and-effect relationships in Task 2.', related: ['Comparative adjectives'] },

  // ---------- Articles ----------
  { title: 'Definite article "the"', category: 'Articles', explanation: 'Used for something specific, already known, or unique.', structure: 'the + noun', example: 'The government has announced new environmental regulations.', commonError: { wrong: 'Government has announced new environmental regulations.', right: 'The government has announced new environmental regulations.' }, skills: ['writing'], difficulty: 'beginner', tip: '"The government", "the internet", and "the environment" almost always take "the".', related: ['Zero article for general ideas'] },
  { title: 'Zero article for general ideas', category: 'Articles', explanation: 'No article is used when speaking about something in general.', structure: '(no article) + plural/uncountable noun', example: 'Education plays a vital role in reducing poverty.', commonError: { wrong: 'The education plays a vital role in reducing poverty.', right: 'Education plays a vital role in reducing poverty.' }, skills: ['writing'], difficulty: 'intermediate', tip: 'Don\'t add "the" before abstract nouns like education, society, or technology when speaking generally.', related: ['Definite article "the"'] },
  { title: 'Indefinite article a/an', category: 'Articles', explanation: 'Used for one non-specific example of a countable noun.', structure: 'a/an + singular countable noun', example: 'A growing number of students are choosing to study abroad.', commonError: { wrong: 'Growing number of students are choosing to study abroad.', right: 'A growing number of students are choosing to study abroad.' }, skills: ['writing'], difficulty: 'beginner', tip: '"A number of" and "a growing number of" both need "a" before them.', related: ['Definite article "the"'] },

  // ---------- Modals ----------
  { title: 'Modals of obligation', category: 'Modals', explanation: 'Used to express necessity or requirement.', structure: 'must / have to + base verb', example: 'Governments must take immediate action to curb emissions.', commonError: { wrong: 'Governments must to take immediate action.', right: 'Governments must take immediate action.' }, skills: ['writing','speaking'], difficulty: 'beginner', tip: 'Never add "to" after "must".', related: ['Modals of possibility'] },
  { title: 'Modals of possibility', category: 'Modals', explanation: 'Used to express degrees of likelihood.', structure: 'may / might / could + base verb', example: 'This trend could lead to a shortage of skilled workers in the future.', commonError: { wrong: 'This trend could leads to a shortage of skilled workers.', right: 'This trend could lead to a shortage of skilled workers.' }, skills: ['writing','speaking'], difficulty: 'intermediate', tip: 'Always followed by the base form of the verb, with no "-s" or "to".', related: ['Modals of obligation'] },
  { title: 'Modals of advice', category: 'Modals', explanation: 'Used to recommend a course of action.', structure: 'should / ought to + base verb', example: 'Schools should introduce more practical, skill-based subjects.', commonError: { wrong: 'Schools should to introduce more practical subjects.', right: 'Schools should introduce more practical, skill-based subjects.' }, skills: ['writing','speaking'], difficulty: 'beginner', tip: 'A useful, natural way to phrase Task 2 recommendations.', related: ['Modals of obligation'] },

  // ---------- Complex Sentences & Subordination ----------
  { title: 'Contrast: although / despite', category: 'Complex Sentences', explanation: 'Used to link two contrasting ideas in one sentence.', structure: 'Although + clause, ... / Despite + noun/-ing, ...', example: 'Although renewable energy is more expensive to set up, it is cheaper to run in the long term.', commonError: { wrong: 'Despite renewable energy is more expensive, it is cheaper to run in the long term.', right: 'Despite being more expensive to set up, renewable energy is cheaper to run in the long term.' }, skills: ['writing','speaking'], difficulty: 'intermediate', tip: '"Despite" is followed by a noun or -ing form, never a full clause with a subject and verb.', related: ['Cause and effect linkers'] },
  { title: 'Cause and effect linkers', category: 'Complex Sentences', explanation: 'Used to connect a reason with its result.', structure: 'due to / owing to + noun; so that + clause', example: 'Traffic congestion has worsened due to the rapid growth of car ownership.', commonError: { wrong: 'Traffic congestion has worsened due to car ownership is growing rapidly.', right: 'Traffic congestion has worsened due to the rapid growth of car ownership.' }, skills: ['writing'], difficulty: 'intermediate', tip: '"Due to" and "owing to" are followed by a noun phrase, not a full clause.', related: ['Contrast: although / despite'] },
  { title: 'Purpose clauses: so that / in order to', category: 'Complex Sentences', explanation: 'Used to explain the purpose or goal of an action.', structure: 'so that + clause / in order to + base verb', example: 'Cities are investing in bike lanes in order to reduce traffic congestion.', commonError: { wrong: 'Cities are investing in bike lanes for reduce traffic congestion.', right: 'Cities are investing in bike lanes in order to reduce traffic congestion.' }, skills: ['writing','speaking'], difficulty: 'intermediate', tip: '"In order to" is followed by a base verb, not "for + verb-ing".', related: ['Cause and effect linkers'] },
  { title: 'Nominalisation', category: 'Complex Sentences', explanation: 'Turning a verb or adjective into a noun to create a more academic, formal sentence.', structure: 'verb → noun (reduce → reduction, decide → decision)', example: 'The reduction in air pollution has led to noticeable health improvements.', commonError: { wrong: 'To reduce air pollution has led to noticeable health improvements grammatically awkward.', right: 'The reduction in air pollution has led to noticeable health improvements.' }, skills: ['writing'], difficulty: 'advanced', tip: 'A key feature of higher-band academic writing — turns actions into things.', related: ['Passive Voice: present'] },

  // ---------- Reported Speech ----------
  { title: 'Reported statements', category: 'Reported Speech', explanation: 'Used to report what someone said, with the tense shifted back.', structure: 'said (that) + past tense clause', example: 'The researcher said that the results had exceeded expectations.', commonError: { wrong: 'The researcher said that the results exceed expectations.', right: 'The researcher said that the results had exceeded expectations.' }, skills: ['listening','writing'], difficulty: 'intermediate', tip: 'Useful for Listening note-taking and for citing sources in Writing.', related: ['Reported questions'] },
  { title: 'Reported questions', category: 'Reported Speech', explanation: 'Used to report a question, without question word order or a question mark.', structure: 'asked + if/whether/wh-word + subject + verb', example: 'The interviewer asked whether remote work had improved productivity.', commonError: { wrong: 'The interviewer asked whether had remote work improved productivity.', right: 'The interviewer asked whether remote work had improved productivity.' }, skills: ['listening','writing'], difficulty: 'advanced', tip: 'Word order goes back to normal statement order — no inversion.', related: ['Reported statements'] },

  // ---------- Parallel Structure ----------
  { title: 'Parallel structure with lists', category: 'Parallel Structure', explanation: 'All items in a list or comparison should use the same grammatical form.', structure: 'verb-ing, verb-ing, and verb-ing / to + verb, to + verb', example: 'The plan focuses on reducing waste, cutting emissions, and promoting recycling.', commonError: { wrong: 'The plan focuses on reducing waste, cutting emissions, and to promote recycling.', right: 'The plan focuses on reducing waste, cutting emissions, and promoting recycling.' }, skills: ['writing'], difficulty: 'advanced', tip: 'Check every item in a list uses the same grammatical form — a common accuracy error.', related: ['Parallel structure with correlatives'] },
  { title: 'Parallel structure with correlatives', category: 'Parallel Structure', explanation: 'Paired conjunctions like "not only...but also" need matching grammatical structures on both sides.', structure: 'not only X but also Y / both X and Y', example: 'The policy not only reduces emissions but also creates new jobs.', commonError: { wrong: 'The policy not only reduces emissions but also it creates new jobs.', right: 'The policy not only reduces emissions but also creates new jobs.' }, skills: ['writing'], difficulty: 'advanced', tip: 'Keep the same verb form and avoid repeating the subject after "but also".', related: ['Parallel structure with lists'] },

  // ---------- Punctuation & Cohesion ----------
  { title: 'Comma with introductory phrases', category: 'Punctuation & Cohesion', explanation: 'A comma follows an introductory word, phrase or clause before the main clause.', structure: 'Introductory phrase, + main clause.', example: 'Overall, the graph shows a steady increase in online shopping.', commonError: { wrong: 'Overall the graph shows a steady increase in online shopping.', right: 'Overall, the graph shows a steady increase in online shopping.' }, skills: ['writing'], difficulty: 'beginner', tip: 'Always add a comma after "overall", "however", "in conclusion", and similar linkers.', related: ['Semicolons to join related ideas'] },
  { title: 'Semicolons to join related ideas', category: 'Punctuation & Cohesion', explanation: 'A semicolon joins two closely related independent clauses without a conjunction.', structure: 'Clause; clause.', example: 'Renewable energy is becoming cheaper; fossil fuels are becoming less viable.', commonError: { wrong: 'Renewable energy is becoming cheaper, fossil fuels are becoming less viable.', right: 'Renewable energy is becoming cheaper; fossil fuels are becoming less viable.' }, skills: ['writing'], difficulty: 'advanced', tip: 'A comma alone cannot join two full clauses — that\'s called a comma splice.', related: ['Comma with introductory phrases'] },
  { title: 'Cohesive linking words', category: 'Punctuation & Cohesion', explanation: 'Used to connect ideas smoothly between and within sentences.', structure: 'however / furthermore / in addition / therefore + clause', example: 'The policy has reduced traffic; however, it has also raised parking costs.', commonError: { wrong: 'The policy has reduced traffic, however it has also raised parking costs incorrectly punctuated.', right: 'The policy has reduced traffic; however, it has also raised parking costs.' }, skills: ['writing','listening'], difficulty: 'intermediate', tip: 'Use a semicolon or full stop before "however", and a comma after it.', related: ['Semicolons to join related ideas'] },

  // ---------- Common Errors ----------
  { title: 'Subject-verb agreement', category: 'Common Errors', explanation: 'The verb must agree in number with its subject.', structure: 'singular subject + singular verb / plural subject + plural verb', example: 'The number of unemployed workers has risen this year.', commonError: { wrong: 'The number of unemployed workers have risen this year.', right: 'The number of unemployed workers has risen this year.' }, skills: ['writing'], difficulty: 'intermediate', tip: '"The number of" takes a singular verb; "a number of" takes a plural verb.', related: ['Countable & uncountable nouns'] },
  { title: 'Countable & uncountable nouns', category: 'Common Errors', explanation: 'Uncountable nouns have no plural form and take singular verbs.', structure: 'much/less + uncountable noun; many/fewer + countable noun', example: 'There has been less research into this rare condition.', commonError: { wrong: 'There has been less researches into this rare condition, and fewer information available.', right: 'There has been less research into this rare condition, and less information available.' }, skills: ['writing'], difficulty: 'intermediate', tip: '"Information", "research", "advice", and "evidence" are all uncountable in English.', related: ['Subject-verb agreement'] },
  { title: 'Prepositions of time', category: 'Common Errors', explanation: 'Different prepositions are used for different types of time expressions.', structure: 'in + month/year; on + day/date; at + specific time', example: 'The policy will take effect in January and will be reviewed on the 1st of each month.', commonError: { wrong: 'The policy will take effect on January and will be reviewed in the 1st of each month.', right: 'The policy will take effect in January and will be reviewed on the 1st of each month.' }, skills: ['writing','speaking'], difficulty: 'beginner', tip: 'Common exam error — double check "in/on/at" whenever a date or time appears.', related: ['Prepositions of place'] },
  { title: 'Prepositions of place', category: 'Common Errors', explanation: 'Different prepositions describe position or location.', structure: 'in + area/city/country; at + a specific point; on + a surface/street', example: 'The new factory is located in the north of the city, on the main road.', commonError: { wrong: 'The new factory is located at the north of the city, in the main road.', right: 'The new factory is located in the north of the city, on the main road.' }, skills: ['writing','speaking'], difficulty: 'beginner', tip: 'Useful for Task 1 maps: "in the north/south", "on the corner of", "next to".', related: ['Prepositions of time'] },

  // ---------- Sentence Building (fragment ordering focus) ----------
  { title: 'Fronting adverbials', category: 'Complex Sentences', explanation: 'Moving an adverbial phrase to the front of a sentence for emphasis or variety.', structure: 'Adverbial phrase, + subject + verb...', example: 'In recent years, attitudes towards remote work have changed dramatically.', commonError: { wrong: 'Attitudes towards remote work have changed dramatically in recent years, awkwardly.', right: 'In recent years, attitudes towards remote work have changed dramatically.' }, skills: ['writing'], difficulty: 'intermediate', tip: 'A simple way to add sentence variety instead of always starting with the subject.', related: ['Comma with introductory phrases'] },
  { title: 'Inversion after negative adverbials', category: 'Complex Sentences', explanation: 'Question-style word order used after certain negative adverbials for emphasis.', structure: 'Never/Rarely/Not only + auxiliary + subject + verb', example: 'Rarely has a policy attracted so much public debate.', commonError: { wrong: 'Rarely a policy has attracted so much public debate.', right: 'Rarely has a policy attracted so much public debate.' }, skills: ['writing'], difficulty: 'advanced', tip: 'An advanced structure — use sparingly, once per essay at most, for impact.', related: ['Fronting adverbials'] }

];

/* =========================================================
   SENTENCE BUILDER — DATA
   Shows a simple sentence upgraded into a more complex,
   IELTS-appropriate one. swaps: [[simplePart, complexPart], ...]
   ========================================================= */

const SENTENCE_BUILDER_DATA = [
  {
    category: 'Relative Clauses',
    simple: 'I visited the museum. It has a famous dinosaur exhibit.',
    improved: 'I visited the museum, which has a famous dinosaur exhibit.',
    swaps: [['It has', 'which has']]
  },
  {
    category: 'Passive Voice',
    simple: 'Workers pick the coffee beans by hand.',
    improved: 'The coffee beans are picked by hand.',
    swaps: [['Workers pick the coffee beans', 'The coffee beans are picked']]
  },
  {
    category: 'Complex Sentences',
    simple: 'The plan is expensive. It will reduce pollution significantly.',
    improved: 'Although the plan is expensive, it will reduce pollution significantly.',
    swaps: [['The plan is expensive. It', 'Although the plan is expensive, it']]
  },
  {
    category: 'Conditionals',
    simple: 'Maybe more people will cycle. Then traffic will decrease.',
    improved: 'If more people cycled, traffic would decrease.',
    swaps: [['Maybe more people will cycle. Then traffic will decrease', 'If more people cycled, traffic would decrease']]
  },
  {
    category: 'Nominalisation',
    simple: 'The government reduced taxes, and this helped small businesses grow.',
    improved: 'The reduction in taxes helped small businesses grow.',
    swaps: [['The government reduced taxes, and this', 'The reduction in taxes']]
  },
  {
    category: 'Comparatives & Superlatives',
    simple: 'Public transport is good. Private cars are not as good in busy cities.',
    improved: 'Public transport is more efficient than private cars in busy cities.',
    swaps: [['is good. Private cars are not as good', 'is more efficient than private cars']]
  },
  {
    category: 'Cause & Effect',
    simple: 'Car ownership is growing fast. Traffic congestion has worsened.',
    improved: 'Traffic congestion has worsened due to the rapid growth of car ownership.',
    swaps: [['Car ownership is growing fast. Traffic congestion has worsened', 'Traffic congestion has worsened due to the rapid growth of car ownership']]
  },
  {
    category: 'Purpose Clauses',
    simple: 'Cities are building bike lanes. They want to reduce traffic.',
    improved: 'Cities are building bike lanes in order to reduce traffic.',
    swaps: [['They want to reduce traffic', 'in order to reduce traffic']]
  },
  {
    category: 'Parallel Structure',
    simple: 'The plan reduces waste. It also cuts emissions. It promotes recycling too.',
    improved: 'The plan reduces waste, cuts emissions, and promotes recycling.',
    swaps: [['reduces waste. It also cuts emissions. It promotes recycling too', 'reduces waste, cuts emissions, and promotes recycling']]
  },
  {
    category: 'Modals',
    simple: 'It is a good idea for schools to teach practical skills.',
    improved: 'Schools should introduce more practical, skill-based subjects.',
    swaps: [['It is a good idea for schools to teach', 'Schools should introduce more']]
  },
  {
    category: 'Reported Speech',
    simple: 'The researcher said: "The results exceeded our expectations."',
    improved: 'The researcher said that the results had exceeded expectations.',
    swaps: [['said: "The results exceeded', 'said that the results had exceeded']]
  },
  {
    category: 'Double Comparatives',
    simple: 'If cities invest more in cycling infrastructure, fewer cars will be on the road.',
    improved: 'The more cities invest in cycling infrastructure, the fewer cars are on the road.',
    swaps: [['If cities invest more', 'The more cities invest'], ['fewer cars will be', 'the fewer cars are']]
  }
];
