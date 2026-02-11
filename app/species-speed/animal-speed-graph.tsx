/* eslint-disable */
"use client";
import { max } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis"; // D3 is a JavaScript library for data visualization: https://d3js.org/
import { csv } from "d3-fetch";
import { scaleBand, scaleLinear, scaleOrdinal } from "d3-scale";
import { select } from "d3-selection";
import { useEffect, useRef, useState } from "react";

// Example data: Only the first three rows are provided as an example
// Add more animals or change up the style as you desire

// TODO: Write this interface
interface AnimalDatum {
  name: string;
  speed: number;
  diet: "Herbivore" | "Omnivore" | "Carnivore";
}

export default function AnimalSpeedGraph() {
  // useRef creates a reference to the div where D3 will draw the chart.
  // https://react.dev/reference/react/useRef
  const graphRef = useRef<HTMLDivElement>(null);

  const [animalData, setAnimalData] = useState<AnimalDatum[]>([]);

  // TODO: Load CSV data
  useEffect(() => {
    csv("/sample_animals.csv", (row) => {
      // Match the CSV headers you actually have
      const name = String(row["Animal"] ?? "").trim();
      const speed = Number(row["Average Speed (km/h)"]);
      const dietRaw = String(row["Diet"] ?? "")
        .trim()
        .toLowerCase();

      // Normalize diet to your union type
      const dietMap: Record<string, AnimalDatum["diet"]> = {
        herbivore: "Herbivore",
        omnivore: "Omnivore",
        carnivore: "Carnivore",
      };
      const diet = dietMap[dietRaw];

      if (!name) return null;
      if (!Number.isFinite(speed)) return null;
      if (!diet) return null;

      return { name, speed, diet };
    })
      .then((data) => {
        console.log("Loaded rows after parsing/filtering:", data.length);
        setAnimalData(data);
      })
      .catch((err) => {
        console.error("Failed to load CSV:", err);
        setAnimalData([]);
      });
  }, []);

  useEffect(() => {
    // Sort from greatest speed → lowest speed
    const sortedData = [...animalData].sort((a, b) => b.speed - a.speed);

    // Clear any previous SVG/tooltip to avoid duplicates when React hot-reloads
    if (graphRef.current) {
      graphRef.current.innerHTML = "";
    }

    if (!graphRef.current || sortedData.length === 0) return;

    // Tooltip (absolute-positioned inside the container)
    const tooltip = select(graphRef.current)
      .append("div")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("background", "rgba(0,0,0,0.85)")
      .style("color", "white")
      .style("padding", "8px 10px")
      .style("border-radius", "8px")
      .style("font-size", "12px")
      .style("line-height", "1.25");

    // Dimensions
    const containerWidth = graphRef.current.clientWidth || 800;
    const containerHeight = graphRef.current.clientHeight || 500;

    const width = Math.max(containerWidth, 600);
    const height = Math.max(containerHeight, 400);
    const margin = { top: 70, right: 60, bottom: 80, left: 100 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 1) Create SVG
    const svg = select(graphRef.current).append("svg").attr("width", width).attr("height", height);

    // A group translated by margins (so axes/bars fit)
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // 2) Scales

    // x: animal names (bars still map to each animal)
    const x = scaleBand<string>()
      .domain(sortedData.map((d) => d.name))
      .range([0, innerWidth])
      .padding(0.2);

    // y: speeds
    const yMax = max(sortedData, (d) => d.speed) ?? 0;
    const y = scaleLinear()
      .domain([0, yMax || 1])
      .nice()
      .range([innerHeight, 0]);

    // color: by diet
    const color = scaleOrdinal<AnimalDatum["diet"], string>()
      .domain(["Herbivore", "Omnivore", "Carnivore"])
      .range(["#4caf50", "#ff9800", "#f44336"]);

    // 3) Axes

    // x-axis at bottom BUT NO labels (hide tick text)
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(axisBottom(x).tickFormat(() => ""));

    // y-axis at left
    g.append("g").call(axisLeft(y));

    // Y axis label
    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .text("Speed (km/h)");

    // X axis label
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .text("Animals (hover bars for details)");

    // 4) Bars + tooltip hover
    g.selectAll("rect")
      .data(sortedData, (d: any) => d.name)
      .join("rect")
      .attr("x", (d) => x(d.name) ?? 0)
      .attr("y", (d) => y(d.speed))
      .attr("width", x.bandwidth())
      .attr("height", (d) => innerHeight - y(d.speed))
      .attr("fill", (d) => color(d.diet))
      .attr("opacity", 0.85)
      .on("mouseenter", function (event, d) {
        select(this).attr("opacity", 1);

        tooltip.style("opacity", 1).html(
          `<div><strong>${d.name}</strong></div>
            <div>Speed: ${d.speed.toFixed(1)} km/h</div>
            <div>Diet: ${d.diet}</div>`,
        );
      })
      .on("mousemove", function (event: any) {
        // Use offsetX/Y because tooltip is positioned relative to the container div
        tooltip.style("left", `${event.offsetX + 12}px`).style("top", `${event.offsetY + 12}px`);
      })
      .on("mouseleave", function () {
        select(this).attr("opacity", 0.85);
        tooltip.style("opacity", 0);
      });

    // Title
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", margin.top / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", 18)
      .attr("font-weight", 600)
      .text("Animal Speed by Diet");

    // 5) Legend
    const legend = svg.append("g").attr("transform", `translate(${width - margin.right - 140}, ${margin.top - 40})`);

    const diets: AnimalDatum["diet"][] = ["Carnivore", "Herbivore", "Omnivore"];

    diets.forEach((diet, i) => {
      const legendRow = legend.append("g").attr("transform", `translate(0, ${i * 25})`);
      legendRow.append("rect").attr("width", 18).attr("height", 18).attr("fill", color(diet));
      legendRow.append("text").attr("x", 25).attr("y", 14).attr("font-size", 14).text(diet);
    });
  }, [animalData]);

  // TODO: Return the graph
  return (
    // Placeholder so that this compiles. Delete this below:
    <div
      ref={graphRef}
      style={{
        width: "100%",
        height: "500px",
        position: "relative",
      }}
    />
  );
}
