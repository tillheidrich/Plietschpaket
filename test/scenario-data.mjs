// Demo data for the scenario content type (shared by tests).
export const DEMO_SCENARIO = {
  intro: { kicker: 'Customer service', text: 'An upset customer is standing at your desk. Stay calm and find a solution.' },
  characters: [{ key: 'customer', name: 'Mr Chen', look: 'chen', color: '#c4b5fd' }],
  scenes: [
    {
      key: 'start', situation: 'A customer approaches the desk, red-faced and visibly upset.', background: 'service', character: 'customer', expression: 'angry', pose: 'auto', position: 'right',
      line: 'I have been trying to return this broken device for two weeks and nobody has helped me!',
      choices: [
        { text: 'Listen calmly, acknowledge the frustration and apologise for the wait', next: 'listen', points: 2, tone: 'good', feedback: 'He takes a breath. He feels taken seriously.' },
        { text: 'Explain why the process takes time', next: 'mixed', points: 0, tone: 'neutral', feedback: 'He barely listens. He wanted help, not an explanation.' },
        { text: 'Ask him to lower his voice because other customers are waiting', next: 'escalated', points: -1, tone: 'bad', feedback: 'Now he gets really loud.' }
      ]
    },
    {
      key: 'listen', background: 'service', character: 'customer', expression: 'worried', position: 'right', line: 'So what can you actually do for me now?',
      choices: [
        { text: 'Start the return myself right away and hand him a confirmation', next: 'good', points: 2, tone: 'good', feedback: 'He relaxes and nods.' },
        { text: 'Point him to the online form', next: 'mixed', points: 0, tone: 'neutral' }
      ]
    }
  ],
  endings: [
    { key: 'good', title: 'Problem solved', text: 'The customer leaves satisfied and thanks you.', rating: 'good' },
    { key: 'mixed', title: 'Half solved', text: 'He is calmer, but not convinced.', rating: 'mixed' },
    { key: 'escalated', title: 'Escalated', text: 'He asks for the branch manager.', rating: 'bad' }
  ],
  theme: { mode: 'dark', accent: '#7c6cf0' },
  behaviour: { scoring: 'points', passPercent: 70, tts: true, autoNarrate: false, showFeedback: true, allowRetry: true }
};
