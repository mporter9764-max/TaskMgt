"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { addDays, monthEnd, monthIndex, MONTHS, MONTHS_LONG, todayStr } from "@/lib/dates";
import type { TasksStore } from "@/lib/useTasksStore";
import { deepen } from "@/lib/colors";
import { TimelineView, ZOOMS } from "./TimelineView";
import { AgendaView } from "./AgendaView";
import { GroupManager } from "./GroupManager";
import { Button, Chip, IconButton, Segmented, Switch } from "../ui";
import { Cog, ListIcon, Plus, TimelineIcon, ZoomIn, ZoomOut } from "../icons";

type Mode = "timeline" | "list";

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export function TasksView({
  store,
  active,
  onOpenTask,
  onNewTask,
  onNewTaskInGroup,
}: {
  store: TasksStore;
  active: boolean;
  onOpenTask: (task: Task, occDate: string | null) => void;
  onNewTask: () => void;
  onNewTaskInGroup: (groupId: string | null) => void;
}) {
  const [mode, setMode] = useState<Mode>("list");
  const [zoom, setZoom] = useState(1);
  const [jump, setJump] = useState<{ to: string | null; n: number }>({ to: null, n: 0 });
  const today = todayStr();
  // first day of each of the next three months
  const nextMonths = useMemo(() => {
    const out: string[] = [];
    let d = today;
    for (let i = 0; i < 3; i++) {
      d = addDays(monthEnd(d), 1);
      out.push(d);
    }
    return out;
  }, [today]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [manageGroups, setManageGroups] = useState(false);

  useEffect(() => {
    const wide = window.innerWidth >= 900;
    setMode(readPref<Mode>("taskmgt.taskMode", wide ? "timeline" : "list"));
    setZoom(Number(readPref<string>("taskmgt.zoom", "1")) || 1);
    setShowCompleted(readPref<string>("taskmgt.showDone", "0") === "1");
  }, []);

  const hasUngrouped = store.tasks.some((t) => !t.group_id || !store.groups.some((g) => g.id === t.group_id));
  const visibleGroups = store.groups.filter((g) => !hidden.has(g.id));
  const showUngrouped = hasUngrouped && !hidden.has("__none");

  const filteredTasks = useMemo(() => {
    const known = new Set(store.groups.map((g) => g.id));
    return store.tasks.filter((t) => {
      const gid = t.group_id && known.has(t.group_id) ? t.group_id : "__none";
      return !hidden.has(gid);
    });
  }, [store.tasks, store.groups, hidden]);

  function toggleGroup(id: string) {
    // first tap from "All" focuses that one group; later taps add or remove groups
    if (hidden.size === 0) {
      onlyGroup(id);
      return;
    }
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      const all = [...store.groups.map((g) => g.id), "__none"];
      return all.every((x) => next.has(x)) ? new Set<string>() : next;
    });
  }

  function onlyGroup(id: string) {
    const all = [...store.groups.map((g) => g.id), "__none"];
    setHidden(new Set(all.filter((x) => x !== id)));
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <Segmented<Mode>
          value={mode}
          onChange={(m) => {
            setMode(m);
            writePref("taskmgt.taskMode", m);
          }}
          options={[
            { value: "list", label: <><ListIcon size={15} /> List</> },
            { value: "timeline", label: <><TimelineIcon size={15} /> Timeline</> },
          ]}
        />
        {mode === "timeline" && (
          <div className="flex items-center">
            <IconButton
              label="Zoom out"
              disabled={zoom === 0}
              onClick={() => {
                const z = Math.max(0, zoom - 1);
                setZoom(z);
                writePref("taskmgt.zoom", String(z));
              }}
            >
              <ZoomOut />
            </IconButton>
            <IconButton
              label="Zoom in"
              disabled={zoom === ZOOMS.length - 1}
              onClick={() => {
                const z = Math.min(ZOOMS.length - 1, zoom + 1);
                setZoom(z);
                writePref("taskmgt.zoom", String(z));
              }}
            >
              <ZoomIn />
            </IconButton>
            <Button
              size="sm"
              variant="ghost"
              className={jump.to === null ? "text-ink" : ""}
              onClick={() => setJump((j) => ({ to: null, n: j.n + 1 }))}
            >
              Today
            </Button>
            {nextMonths.map((m) => (
              <Button
                key={m}
                size="sm"
                variant="ghost"
                title={`Jump to ${MONTHS_LONG[monthIndex(m)]} 1, ${m.slice(0, 4)}`}
                className={jump.to === m ? "bg-sunken text-ink" : ""}
                onClick={() => setJump((j) => ({ to: m, n: j.n + 1 }))}
              >
                {MONTHS[monthIndex(m)]}
                {m.slice(0, 4) !== today.slice(0, 4) && <span className="text-faint">{` \u2019${m.slice(2, 4)}`}</span>}
              </Button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <Switch
          checked={showCompleted}
          onChange={(v) => {
            setShowCompleted(v);
            writePref("taskmgt.showDone", v ? "1" : "0");
          }}
          label="Done"
        />
        <IconButton label="Manage groups" onClick={() => setManageGroups(true)}>
          <Cog />
        </IconButton>
        <Button variant="primary" className="hidden sm:inline-flex" onClick={onNewTask}>
          <Plus size={16} /> New task
        </Button>
      </div>

      <div className="scrollbar-thin -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Chip active={hidden.size === 0} onClick={() => setHidden(new Set())}>
          All
        </Chip>
        {store.groups.map((g) => (
          <Chip key={g.id} active={!hidden.has(g.id) && hidden.size > 0} color={deepen(g.color, 0.15)} onClick={() => toggleGroup(g.id)}>
            {g.name}
          </Chip>
        ))}
        {hasUngrouped && (
          <Chip active={!hidden.has("__none") && hidden.size > 0} onClick={() => toggleGroup("__none")}>
            No group
          </Chip>
        )}
      </div>

      <div className={mode === "timeline" ? "min-h-0 flex-1" : "min-h-0 flex-1 overflow-y-auto"}>
        {mode === "timeline" ? (
          <TimelineView
            tasks={filteredTasks}
            groups={visibleGroups}
            showUngrouped={showUngrouped}
            occDone={store.occDone}
            showCompleted={showCompleted}
            zoom={zoom}
            jump={jump}
            active={active}
            onOpen={onOpenTask}
            onMove={store.moveTask}
            onAdd={onNewTaskInGroup}
          />
        ) : (
          <AgendaView
            tasks={filteredTasks}
            groups={store.groups}
            occDone={store.occDone}
            showCompleted={showCompleted}
            onOpen={onOpenTask}
            onToggleTask={store.toggleTask}
            onToggleOcc={store.toggleOccurrence}
          />
        )}
      </div>

      <GroupManager open={manageGroups} onClose={() => setManageGroups(false)} store={store} />
    </div>
  );
}
