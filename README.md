# stride
Stride: what needs to be done by Friday evening

Submission deadline: Saturday, November 29, 11:59 LA time. We want to submit by 10:00. Checkpoint: a working version in the simulator by Friday evening.

0. Setup (1 hour)

npm install -g @evenrealities/evenhub-cli @evenrealities/evenhub-simulator
Template: npx degit even-realities/evenhub-templates/minimal into the repository github.com/daemon4d-us/stride
Documentation: https://hub.evenrealities.com/docs/get-started/index

1. Server (all external calls go through it, since the glasses' WebView can't make them directly)

Google sign-in (Gmail + Calendar) through a separate web page on the server, because Google sign-in doesn't work inside the glasses. For the demo, you can sign in once with your own account.
Speech recognition: the microphone outputs 16 kHz PCM, which we send to the server and run through any STT there (Whisper, Deepgram, Soniox).
Claude: shortens each email to 1 line and drafts a reply.

2. Feature priority (if you run out of time, cut from the bottom)

Gmail: latest important emails, Claude writes 1 line for each, swipe to scroll through them.
Voice reply to an email: I say a phrase → Claude writes the reply → tap sends, double tap cancels.
Telegram: "Message Dima: I'm on my way" → sent. A bot is simpler, but a bot can only message people who have started it. That's enough for the demo, but for the Telegram prize it's better to send real messages from the user's account (TDLib or Telethon), if you have time.
Calendar: next meeting (when, with whom, what about). Only if there's time left.

3. Display: 576×288, text and borders only. While walking, show 1 large line, with details on tap. Nastya will send Figma mockups.

4. By Saturday morning

Record the simulator screen following the script: email → voice reply → "Sent" → Telegram → meeting.
README: what it does, how to run it, the stack, and a required separate section on what was built before November 23 (per hackathon rules).
Create a Build on DoraHacks: name Stride, repository, video, backup Discord contact daemon4d.us, add @anastasiakiek to the team.

How we stand out from competitors (the hackathon already has Nod with Gmail and Claude, plus 5 or 6 Telegram apps): email, calendar and Telegram in 1 app, built around an "on the go, walking" scenario. This needs to come across in the video and be the first line of the description.

The riskiest parts for him will be Google sign-in and speech recognition, so he should start with those. If you want, I can also write a short DoraHacks description for Stride, so on Saturday you only need to paste it in.
