# FileAtlas

**Built at greenCode Hackathon 2025**

> [View our pitch deck](https://www.canva.com/design/DAHLJVAk1ew/49H0boQ0hQQVioSjfTcOtg/edit)

---

## About greenCode

greenCode was a hackathon focused on building software tools that help people work smarter and more sustainably. Teams competed to create practical, polished products over a short sprint, with an emphasis on real-world utility and clean engineering.

---

## What is FileAtlas?

FileAtlas is a smart file management tool that visualizes your Google Drive as an interactive node graph. Instead of navigating nested folder lists, you see your entire project structure as a living map — folders branch from a project bubble, files branch from folders, and subfolders branch from their parents — all connected by clean SVG elbow connectors.

The goal: make it immediately obvious how your files relate to each other, surface duplicates before they become a problem, and let you create and organize files without leaving the view.

---

## Features

### Interactive Node Graph
- Your Drive folder is rendered as a left-to-right node graph: project bubble → folders → files → version history
- Click any folder to expand it and reveal its files and subfolders as branching nodes
- Subfolders stem from their parent folder with tree-style SVG connectors, the same way files do
- SVG branch lines are obstacle-aware — they automatically reroute around nodes to avoid visual clutter

### Google Drive Integration
- Sign in with Google to import any Drive folder as a project
- Lazy-loads subfolder contents on expand so large drives stay fast
- Cmd/Ctrl-click any node to open it directly in Google Drive
- Drag a file pill onto another folder to move it (synced to Drive instantly)

### Create Files and Folders
- The +Folder and +File buttons create nodes in both the local graph and your actual Google Drive
- File type picker lets you create Google Docs, Slide Decks, or Sheets
- Choose which folder to place the new item in from inside the modal

### AI Name Suggestion (Drive sign-in required)
- When creating a file or folder, describe what it's for in an optional purpose field
- Hit "Suggest" to get an AI-generated name (via OpenAI) that is concise, descriptive, and won't conflict with any existing file names in the project

### Duplicate File Scanner
- Scans your Google Drive for duplicate or near-duplicate files
- Groups them by similarity so you can identify redundant copies

### Natural Language Search
- Search across your project files using plain English queries

### Shift-Drag Repositioning
- Hold Shift and drag any node to reposition it freely on the canvas
- A Reset button restores the original auto-layout

---

## Team

| Name | GitHub |
|------|--------|
| Ansh Nayak | [@AnshN009](https://github.com/AnshN009) |
| Taran Duba | |
| Mukesh Ramanathan | |
| Hannah Kim | |

---

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You'll need a `.env.local` with:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OPENAI_API_KEY=...
```
