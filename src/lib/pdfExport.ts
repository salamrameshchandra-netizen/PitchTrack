/**
 * PDF Export Service for Cricket Pitch Tracking & Performance Analytics
 * Generates high quality visual reports using jsPDF & jspdf-autotable
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BowlerProfile, OverRecord, BallDelivery, LengthZone, LENGTH_ZONES_CONFIG, LINE_ZONES_CONFIG } from '../types';

export interface PDFExportOptions {
  title?: string;
  bowler?: BowlerProfile | null;
  overs: OverRecord[];
  dateRangeLabel?: string;
  includePitchMap?: boolean;
}

export function exportDetailedAnalyticsPDF({
  title = 'Cricket Bowling & Pitch Map Performance Report',
  bowler,
  overs,
  dateRangeLabel = 'All Time',
  includePitchMap = true,
}: PDFExportOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Color palette
  const primaryColor = [22, 101, 52]; // Dark Emerald
  const accentColor = [37, 99, 235]; // Royal Blue
  const textDark = [30, 41, 59];
  const textMuted = [100, 116, 139];

  // Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PITCHTRACK PRO', 14, 12);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Cricket Ball Pitching & Bowling Performance Analytics', 14, 18);

  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, pageWidth - 14, 12, { align: 'right' });
  doc.text(`Period: ${dateRangeLabel}`, pageWidth - 14, 18, { align: 'right' });

  let cursorY = 36;

  // Bowler Summary Card if specific bowler
  if (bowler) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, cursorY, pageWidth - 28, 24, 3, 3, 'FD');

    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(bowler.name, 18, cursorY + 8);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(`Team: ${bowler.team || 'N/A'}  |  Style: ${bowler.bowlingStyle}  |  Jersey: #${bowler.jerseyNumber || '-'}`, 18, cursorY + 14);
    if (bowler.notes) {
      doc.text(`Notes: ${bowler.notes}`, 18, cursorY + 19);
    }
    cursorY += 28;
  }

  // Aggregate stats across selected overs
  const allBalls = overs.flatMap((o) => o.balls);
  const legalBalls = allBalls.filter((b) => b.isLegal);
  const totalRuns = overs.reduce((sum, o) => sum + o.totalRuns, 0);
  const totalWickets = overs.reduce((sum, o) => sum + o.totalWickets, 0);
  const totalDots = allBalls.filter((b) => b.outcome === 'dot').length;
  const totalMaidens = overs.filter((o) => o.isMaiden).length;
  const oversCount = (Math.floor(legalBalls.length / 6) + (legalBalls.length % 6) / 10).toFixed(1);
  const economy = legalBalls.length > 0 ? ((totalRuns / (legalBalls.length / 6))).toFixed(2) : '0.00';
  const average = totalWickets > 0 ? (totalRuns / totalWickets).toFixed(2) : 'N/A';
  const strikeRate = totalWickets > 0 ? (legalBalls.length / totalWickets).toFixed(1) : 'N/A';
  const dotBallPct = legalBalls.length > 0 ? ((totalDots / legalBalls.length) * 100).toFixed(1) : '0.0';

  // KPI Summary Boxes
  const kpis = [
    { label: 'OVERS BOWLED', val: oversCount },
    { label: 'RUNS CONCEDED', val: String(totalRuns) },
    { label: 'WICKETS', val: String(totalWickets) },
    { label: 'ECONOMY', val: economy },
    { label: 'AVERAGE', val: average },
    { label: 'DOT BALL %', val: `${dotBallPct}%` },
  ];

  const boxWidth = (pageWidth - 28 - (kpis.length - 1) * 3) / kpis.length;
  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (boxWidth + 3);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x, cursorY, boxWidth, 16, 2, 2, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(kpi.label, x + boxWidth / 2, cursorY + 5, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text(kpi.val, x + boxWidth / 2, cursorY + 12, { align: 'center' });
  });

  cursorY += 22;

  // Length Zone Distribution Table
  const lengthZones: LengthZone[] = [
    'yorker',
    'over_pitch',
    'full_length',
    'good_length',
    'short_of_good_length',
    'short',
  ];

  const lengthStats = lengthZones.map((zoneKey) => {
    const cfg = LENGTH_ZONES_CONFIG[zoneKey];
    const ballsInZone = allBalls.filter((b) => b.lengthZone === zoneKey);
    const count = ballsInZone.length;
    const runs = ballsInZone.reduce((s, b) => s + b.runsScored, 0);
    const wkts = ballsInZone.filter((b) => b.isWicket).length;
    const dots = ballsInZone.filter((b) => b.outcome === 'dot').length;
    const pct = allBalls.length > 0 ? ((count / allBalls.length) * 100).toFixed(1) + '%' : '0%';
    const eco = count > 0 ? (runs / (count / 6)).toFixed(2) : '0.00';
    return {
      zone: cfg.name,
      dist: `${cfg.minDistMeters}m - ${cfg.maxDistMeters}m`,
      count,
      pct,
      runs,
      wkts,
      dots,
      eco,
    };
  });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('Pitch Length Distribution & Effectiveness', 14, cursorY);
  cursorY += 3;

  autoTable(doc, {
    startY: cursorY,
    head: [['Length Zone', 'Pitch Range', 'Balls', 'Share %', 'Runs', 'Wkts', 'Dots', 'Economy']],
    body: lengthStats.map((s) => [s.zone, s.dist, s.count, s.pct, s.runs, s.wkts, s.dots, s.eco]),
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    margin: { left: 14, right: 14 },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 8;

  // Draw 2D Vector Cricket Pitch Map on PDF
  if (includePitchMap && cursorY < pageHeight - 90) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text('2D Pitch Map - Ball Landing Heatmap', 14, cursorY);
    cursorY += 4;

    const pitchWidthMm = 70;
    const pitchHeightMm = 65;
    const pitchLeftMm = 14;

    // Grass outfield border
    doc.setFillColor(30, 70, 32);
    doc.roundedRect(pitchLeftMm, cursorY, pitchWidthMm, pitchHeightMm, 2, 2, 'F');

    // Pitch Strip
    const stripWidth = pitchWidthMm * 0.76;
    const stripLeft = pitchLeftMm + (pitchWidthMm - stripWidth) / 2;
    doc.setFillColor(210, 180, 140); // Tan/Clay
    doc.rect(stripLeft, cursorY + 2, stripWidth, pitchHeightMm - 4, 'F');

    // Stumps line at top (batting end)
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.4);
    doc.line(stripLeft, cursorY + 5, stripLeft + stripWidth, cursorY + 5);

    // Popping Crease line
    doc.line(stripLeft - 3, cursorY + 9, stripLeft + stripWidth + 3, cursorY + 9);

    // Stumps
    doc.setFillColor(255, 220, 100);
    const midX = stripLeft + stripWidth / 2;
    doc.rect(midX - 1.5, cursorY + 3.5, 0.8, 1.8, 'FD');
    doc.rect(midX - 0.4, cursorY + 3.5, 0.8, 1.8, 'FD');
    doc.rect(midX + 0.7, cursorY + 3.5, 0.8, 1.8, 'FD');

    // Draw length division bands
    const bands = [
      { yRatio: 0.125, color: [239, 68, 68] }, // Yorker
      { yRatio: 0.25, color: [249, 115, 22] }, // Overpitch
      { yRatio: 0.416, color: [16, 185, 129] }, // Full
      { yRatio: 0.583, color: [59, 130, 246] }, // Good Length
      { yRatio: 0.75, color: [139, 92, 246] }, // Short of Good
      { yRatio: 1.0, color: [236, 72, 153] }, // Short
    ];

    let prevY = cursorY + 2;
    bands.forEach((b) => {
      const lineY = cursorY + 2 + (pitchHeightMm - 4) * b.yRatio;
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.15);
      doc.line(stripLeft, lineY, stripLeft + stripWidth, lineY);
      prevY = lineY;
    });

    // Plot ball delivery dots
    allBalls.forEach((ball) => {
      const bx = stripLeft + (stripWidth * ball.xPercent) / 100;
      const by = cursorY + 2 + ((pitchHeightMm - 4) * ball.yPercent) / 100;

      if (ball.isWicket) {
        doc.setFillColor(220, 38, 38); // Red
        doc.circle(bx, by, 1.3, 'FD');
      } else if (ball.runsScored >= 4) {
        doc.setFillColor(147, 51, 234); // Purple
        doc.circle(bx, by, 1.0, 'FD');
      } else if (ball.runsScored > 0) {
        doc.setFillColor(2, 132, 199); // Blue
        doc.circle(bx, by, 0.9, 'FD');
      } else {
        doc.setFillColor(71, 85, 105); // Grey dot
        doc.circle(bx, by, 0.8, 'FD');
      }
    });

    // Legend on the side of Pitch
    const legX = pitchLeftMm + pitchWidthMm + 10;
    let legY = cursorY + 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text('Pitch Zones & Key:', legX, legY);
    legY += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const legendItems = [
      { label: 'Yorker (0-1.5m)', color: [239, 68, 68] },
      { label: 'Overpitch (1.5-3m)', color: [249, 115, 22] },
      { label: 'Full Length (3-5m)', color: [16, 185, 129] },
      { label: 'Good Length (5-7m)', color: [59, 130, 246] },
      { label: 'Short of Good (7-9m)', color: [139, 92, 246] },
      { label: 'Short Pitch (9-12m+)', color: [236, 72, 153] },
    ];

    legendItems.forEach((item) => {
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.circle(legX + 2, legY - 1, 1.8, 'F');
      doc.text(item.label, legX + 7, legY);
      legY += 5;
    });

    // Ball outcomes legend
    legY += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Ball Markers:', legX, legY);
    legY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFillColor(220, 38, 38);
    doc.circle(legX + 2, legY - 1, 1.8, 'FD');
    doc.text('Wicket (W)', legX + 7, legY);
    legY += 4.5;

    doc.setFillColor(147, 51, 234);
    doc.circle(legX + 2, legY - 1, 1.5, 'FD');
    doc.text('Boundary (4s / 6s)', legX + 7, legY);
    legY += 4.5;

    doc.setFillColor(2, 132, 199);
    doc.circle(legX + 2, legY - 1, 1.3, 'FD');
    doc.text('Singles / 2s / 3s', legX + 7, legY);
    legY += 4.5;

    doc.setFillColor(71, 85, 105);
    doc.circle(legX + 2, legY - 1, 1.2, 'FD');
    doc.text('Dot Ball (•)', legX + 7, legY);

    cursorY += pitchHeightMm + 8;
  }

  // Page 2: Detailed Over-by-Over Breakdown
  doc.addPage();
  cursorY = 20;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('Detailed Over-by-Over Log & Deliveries', 14, cursorY);
  cursorY += 6;

  const overRows: (string | number)[][] = [];
  overs.forEach((over) => {
    const ballSequence = over.balls
      .map((b) => (b.isWicket ? 'W' : b.outcome === 'dot' ? '•' : b.outcome === 'wide' ? 'Wd' : b.outcome === 'no_ball' ? 'Nb' : String(b.runsScored)))
      .join(' ');

    overRows.push([
      over.matchDate || 'N/A',
      over.bowlerName,
      `Over #${over.overNumber}`,
      ballSequence,
      over.totalRuns,
      over.totalWickets,
      over.isMaiden ? 'Yes' : 'No',
      over.notes || '-',
    ]);
  });

  autoTable(doc, {
    startY: cursorY,
    head: [['Date', 'Bowler', 'Over', 'Ball Sequence', 'Runs', 'Wkts', 'Maiden', 'Match / Notes']],
    body: overRows,
    theme: 'striped',
    headStyles: {
      fillColor: [22, 101, 52],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    margin: { left: 14, right: 14 },
  });

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`PitchTrack Cricket Analytics • Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }

  // Save the PDF
  const filename = `PitchTrack_Bowling_Report_${bowler ? bowler.name.replace(/\s+/g, '_') : 'All_Bowlers'}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
