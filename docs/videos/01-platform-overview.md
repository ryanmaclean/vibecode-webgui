# Video Script: Platform Overview (3 minutes)

**Target Audience:** Developers new to the platform
**Goal:** Show how easy it is to create and run an experiment
**Format:** Screen recording with voiceover
**Duration:** 3:00

---

## Scene 1: Introduction (0:00-0:20)

**Visual:** Platform homepage at `http://localhost:3000`

**Narrator:**
"Welcome to the VibeCODE Experimentation Platform. In this 3-minute video, you'll see how easy it is to run production-grade A/B tests and AI experiments. Let's create your first experiment from scratch."

**On-screen text:**
- VibeCODE Experimentation Platform
- From idea to insights in 3 minutes

**Actions:**
- Highlight navigation menu
- Show "Create Experiment" button pulsing

---

## Scene 2: Creating an Experiment (0:20-1:00)

**Visual:** Click "Create Experiment" button

**Narrator:**
"First, click 'Create Experiment.' We'll test whether a green button gets more clicks than our current blue button."

**On-screen actions:**
1. Click "Create Experiment"
2. Select template: "Button Test"
3. Form fills in automatically

**Show form fields:**
```
Experiment Name: CTA Button Color Test
Hypothesis: Green button increases clicks by 20%

Variants:
  ✓ Control: Blue Button (#0066CC)
  ✓ Treatment: Green Button (#28A745)

Primary Metric: Click-through rate
Sample Size: 5,000 users per variant
```

**Narrator:**
"The platform auto-calculates the sample size you need based on your hypothesis. For a 20% improvement in a 5% baseline click rate, we need about 5,000 users per variant."

**On-screen text:**
- Auto-calculated sample size
- Statistical power: 80%
- Significance level: 5%

**Actions:**
- Hover over "Why 5,000?" tooltip
- Show sample size explanation

---

## Scene 3: Adding Guardrails (1:00-1:30)

**Visual:** Scroll down to "Guardrails" section

**Narrator:**
"Before launching, let's add guardrails to protect against breaking the site."

**On-screen actions:**
1. Click "Add Guardrail"
2. Select "Error Rate"
3. Set threshold: < 2%

**Show guardrail configuration:**
```
Guardrails:
  ✓ Error rate < 2%        (Critical - Auto-pause)
  ✓ Page load time < 2s    (Warning - Alert only)
```

**Narrator:**
"Guardrails automatically monitor critical metrics. If errors spike above 2%, the experiment pauses immediately to protect users."

**On-screen text:**
- Guardrails prevent disasters
- Automatic monitoring
- Real-time alerts

**Actions:**
- Toggle "Auto-pause on violation" switch
- Show preview of Slack alert

---

## Scene 4: Launching the Experiment (1:30-2:00)

**Visual:** Click "Launch Experiment" button

**Narrator:**
"Now click 'Launch Experiment.' The platform handles all the complex parts: variant assignment, metric tracking, and statistical analysis."

**On-screen actions:**
1. Click "Launch Experiment"
2. Confirmation modal appears
3. Click "Confirm"
4. Success animation

**Show launch checklist:**
```
✓ Sample size calculated
✓ Guardrails configured
✓ Metrics instrumented
✓ Statistical test selected
✓ Ready to launch
```

**Narrator:**
"The experiment is now live! Users are being randomly assigned to blue or green buttons."

**On-screen text:**
- Experiment Status: LIVE
- Traffic: 50% / 50%
- Duration: 7-14 days

**Actions:**
- Dashboard loads
- Show real-time user count incrementing

---

## Scene 5: Real-Time Dashboard (2:00-2:30)

**Visual:** Experiment dashboard page

**Narrator:**
"The dashboard shows real-time results. You can see click rates, confidence intervals, and statistical significance as data comes in."

**On-screen visuals:**

**Main metrics panel:**
```
Control (Blue Button)
  Click Rate: 5.2%
  Users: 2,487
  Clicks: 129

Treatment (Green Button)
  Click Rate: 6.1%
  Users: 2,513
  Clicks: 153

Difference: +0.9 pp (+17.3% relative)
P-value: 0.042
Status: SIGNIFICANT ✓
```

**Chart showing:**
- Click rate over time (both variants)
- Confidence intervals narrowing
- SRM check: PASSED

**Narrator:**
"After a week, we have statistical significance! The green button is performing 17% better with a p-value of 0.042."

**Actions:**
- Hover over "P-value" for explanation
- Show confidence interval visualization
- Highlight "Decision: Ship Treatment" recommendation

---

## Scene 6: Making the Decision (2:30-2:50)

**Visual:** Experiment decision panel

**Narrator:**
"The platform recommends shipping the green button based on statistical significance and practical impact. Click 'Ship Winner' to roll out to all users."

**On-screen actions:**
1. Click "Ship Winner"
2. Gradual rollout schedule appears

**Show rollout plan:**
```
Gradual Rollout:
  Day 1: 10% of users (canary)
  Day 3: 50% of users
  Day 7: 100% of users (full rollout)

Guardrails remain active during rollout
```

**Narrator:**
"The green button rolls out gradually with continued guardrail monitoring for safety."

**On-screen text:**
- Winner: Green Button
- Impact: +17.3% clicks
- Rollout: Gradual (3 stages)

**Actions:**
- Confirm rollout
- Success message displays

---

## Scene 7: Conclusion (2:50-3:00)

**Visual:** Platform homepage with completed experiment badge

**Narrator:**
"That's it! You've just run a production-grade A/B test in 3 minutes. From hypothesis to rollout, the platform handles the statistics, monitoring, and safety for you."

**On-screen text:**
- 3 minutes from idea to decision
- Backed by statistical rigor
- Protected by guardrails
- Ready for production

**Call to action:**
```
Get Started:
→ Try Tutorial 1: Your First A/B Test
→ Read the Documentation
→ Join our Community
```

**Narrator:**
"Ready to get started? Check out our tutorials to learn more!"

**Actions:**
- Show tutorial links
- Fade to end card

---

## Production Notes

### Screen Resolution
- Record at 1920×1080
- Ensure all UI elements are clearly visible
- Use 150% zoom for small text

### Cursor
- Use large, highlighted cursor
- Slow, deliberate movements
- Pause briefly before clicks

### Pace
- Speak clearly and slowly
- Pause 2 seconds between major actions
- Allow time for viewers to read text

### Background Music
- Subtle, upbeat background music (20% volume)
- No music during narration of technical concepts
- Fade out during conclusion

### Captions
- Add subtitles for all narration
- Highlight key terms (p-value, confidence interval, etc.)
- Include code blocks and numbers in captions

### Annotations
- Use arrows to highlight important UI elements
- Circle key metrics as they appear
- Add "!" icon for warnings and guardrails

### B-Roll Suggestions
- Quick cut to code implementation (0:05 seconds)
- Show sample size calculation formula (0:03 seconds)
- Visualize Beta distribution for guardrails (0:05 seconds)

---

## Voiceover Script (Text Only)

Welcome to the VibeCODE Experimentation Platform. In this 3-minute video, you'll see how easy it is to run production-grade A/B tests and AI experiments. Let's create your first experiment from scratch.

First, click 'Create Experiment.' We'll test whether a green button gets more clicks than our current blue button.

The platform auto-calculates the sample size you need based on your hypothesis. For a 20% improvement in a 5% baseline click rate, we need about 5,000 users per variant.

Before launching, let's add guardrails to protect against breaking the site.

Guardrails automatically monitor critical metrics. If errors spike above 2%, the experiment pauses immediately to protect users.

Now click 'Launch Experiment.' The platform handles all the complex parts: variant assignment, metric tracking, and statistical analysis.

The experiment is now live! Users are being randomly assigned to blue or green buttons.

The dashboard shows real-time results. You can see click rates, confidence intervals, and statistical significance as data comes in.

After a week, we have statistical significance! The green button is performing 17% better with a p-value of 0.042.

The platform recommends shipping the green button based on statistical significance and practical impact. Click 'Ship Winner' to roll out to all users.

The green button rolls out gradually with continued guardrail monitoring for safety.

That's it! You've just run a production-grade A/B test in 3 minutes. From hypothesis to rollout, the platform handles the statistics, monitoring, and safety for you.

Ready to get started? Check out our tutorials to learn more!

---

## File List for Video Production

**Required screenshots/recordings:**
1. `homepage.png` - Platform homepage
2. `create-experiment-form.png` - Experiment creation form
3. `guardrails-config.png` - Guardrail configuration
4. `launch-modal.png` - Launch confirmation
5. `dashboard-live.png` - Live experiment dashboard
6. `results-panel.png` - Results with significance
7. `rollout-plan.png` - Gradual rollout schedule
8. `completion-screen.png` - Success message

**Optional animations:**
1. `user-assignment-animation.gif` - Shows users being assigned to variants
2. `confidence-narrowing.gif` - Confidence interval narrowing over time
3. `guardrail-trigger.gif` - Guardrail violation and auto-pause

---

**Total word count:** 892 words
**Estimated narration time:** 2:45 (allows 15 seconds for pauses and visuals)
