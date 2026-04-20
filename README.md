# 天宇 TianYu — Desktop Voice AI Assistant

A voice-controlled desktop assistant with personality and emotion. Acts based on your commands, Utilizes it's tool to provide you with faster service

---

## What it does

TianYu takes your voice as input and figures out what to do with it. Say something, and it either executes an action or talks back to you through a pixel art speech bubble on your desktop.

**Actions it can perform:**
- Open desktop applications
- Close running applications
- Type text at your current cursor position
- Search the web or open websites in your browser
- Just chat — answer questions, banter, whatever

**It also has feelings.** Based on how you talk to it, TianYu shifts between emotions — energized, neutral, tired, and angry — each one changing how it responds and how it talks back to you. The mood shows up visually through a pixel bubble that changes color depending on its current state.

---

## How it works

**Voice → Text**
Your voice is recorded locally while you hold `Right Alt`. On release, it's transcribed using OpenAI's Whisper running locally — no cloud, no API calls for audio.

**Text → Action**
The transcribed text is passed to Qwen3 4B running locally via Ollama. A system prompt guides the model to pick the right tool — open app, search web, type text, generates chatting response. — and return a structured JSON response that the app executes.

**Emotion system**
A separate lightweight AI pipeline scores each message for sentiment, accumulates a running weight, and maps it to an emotion. Send too many messages too fast and it gets tired. Be rude enough and it gets angry. Be nice and it perks up.

---

## Stack

- **Electron** — desktop app shell (Perhaps for compiling into a desktop app installer later)
- **Whisper** — local speech-to-text
- **Ollama + Qwen3 4B** — local LLM for tool selection and chat response
- **Pixelify Sans** — pixel font for the bubble UI

---

## Trying it out yourself / Forking

You're welcome to fork and try out on your own BUT:

> **Desktop environments differ.** App paths, registry entries, installed software — all of this is specific to the machine it was built on. Things that work out of the box here may not resolve correctly on yours. You'll likely need to adjust paths, tweak the app scanner, or reconfigure things to match your setup.
> **Lack of Testing.** The app has not been tested on other screen sizes / dekstop version / macbook and more. Bubbles may appear out of place, open_app may not be able to find apps in folder.
---

## Disclaimers

**On the AI:**
TianYu uses Qwen3 4B — a small, fast model that runs locally. The tradeoff is that it's less capable than larger models. It can be unpredictable, misunderstand context, pick the wrong tool, or respond in unexpected ways. Loopholes exist. This is the cost of fast response and the best balance between speed and quality in the moment.

**On voice recognition:**
Whisper may struggle with newer slang, or less common words that weren't well represented in its training data. There's also a brief lag of a few milliseconds right after you press `Right Alt` before recording actually starts — speak a beat after pressing, not the instant you press. (Lag is around 0.2 to 0.6 seconds)

---

**That being said this is my first attempt at heavy system prompting, and yet another extremelyproud project of mine :)**
