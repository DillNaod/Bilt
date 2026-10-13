import express from "express";

const app = express();

export function getProfile(req: any, res: any) {
  res.json({ id: req.params.id, status: "active" });
}

app.get("/api/users/:id", getProfile);
