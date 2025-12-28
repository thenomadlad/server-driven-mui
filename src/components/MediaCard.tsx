"use client";

import * as React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";

export interface MediaCardProps {
  heading: string;
  text: string;
}

/**
 * Minimal MediaCard component used by the HomePage. This keeps the UI simple
 * and ensures tests can render the page without missing dependencies.
 */
export default function MediaCard({ heading, text }: MediaCardProps) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography gutterBottom variant="h6" component="div">
          {heading}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {text}
        </Typography>
      </CardContent>
    </Card>
  );
}

