// App.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
  FlatList,
} from "react-native";

/**
 * Fortress: Survival Focused — Pomodoro + Fortress + Creatures + Daily Raids + Creature Defenders
 *
 * New: Tamed creatures now defend your base in raids with species perks:
 * - Raptor (Ambush): +3% effective power per level (cap +30%)
 * - Triceratops (Shield): reduce defeat losses by 20% each (cap 60%)
 * - Pteranodon (Scout): reduce enemy power by 5% each (cap 25%)
 * - Ankylosaurus (Bulwark): +2 flat power per level
 * - Spinosaurus (Rend): on victory, +1 🍖 per level
 */

export default function App() {
  // -------- NAV --------
  const [tab, setTab] = useState("TIMER"); // "TIMER" | "FORTRESS" | "CREATURES" | "RAIDS"

  // -------- TIMER --------
  const [customMinutes, setCustomMinutes] = useState("25");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);

  // -------- ECONOMY --------
  const [resources, setResources] = useState({ wood: 0, stone: 0, food: 0 });
  const [focusTokens, setFocusTokens] = useState(0); // earned per session

  // -------- FORTRESS --------
  const [fortress, setFortress] = useState({
    wallLevel: 0,
    towerLevel: 0,
    hatcheryLevel: 0,
    power: 0,
  });

  // -------- CREATURES --------
  const SPECIES = [
    { name: "Raptor", emoji: "🦖", temperament: "Skittish" },
    { name: "Triceratops", emoji: "🐲", temperament: "Stubborn" },
    { name: "Pteranodon", emoji: "🪽", temperament: "Alert" },
    { name: "Ankylosaurus", emoji: "🛡️", temperament: "Calm" },
    { name: "Spinosaurus", emoji: "🦕", temperament: "Aggressive" },
  ];
  const [wild, setWild] = useState([]);     // wild encounters
  const [stable, setStable] = useState([]); // tamed creatures

  // -------- RAIDS --------
  const todayStr = () => new Date().toDateString();
  const [lastRaidDay, setLastRaidDay] = useState(null);
  const [raidLog, setRaidLog] = useState([]); // { day, enemyPower, myPowerRaw, myPowerEff, enemyEff, result, delta, loot, notes }

  // Sync secondsLeft to editable minutes (only when not running)
  useEffect(() => {
    if (!isRunning) {
      const mins = clampMinutes(customMinutes);
      setSecondsLeft(mins * 60);
    }
  }, [customMinutes, isRunning]);

  // Countdown loop
  useEffect(() => {
    let timer = null;
    if (isRunning && secondsLeft > 0) {
      timer = setInterval(() => setSecondsLeft((p) => p - 1), 1000);
    }
    if (isRunning && secondsLeft === 0) {
      handleSessionComplete();
    }
    return () => clearInterval(timer);
  }, [isRunning, secondsLeft]);

  // ---------- HELPERS ----------
  const clampMinutes = (val) => {
    const n = parseInt(val, 10);
    if (isNaN(n)) return 1;
    return Math.max(1, Math.min(n, 180)); // 1–180 min
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  const symbolFor = (k) => (k === "wood" ? "🪵" : k === "stone" ? "🪨" : "🍖");
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------- REWARDS ON FOCUS COMPLETE ----------
  const handleSessionComplete = () => {
    setIsRunning(false);

    const mins = clampMinutes(customMinutes);
    setSecondsLeft(mins * 60);

    const newWood = randInt(5, 9);
    const newStone = randInt(2, 5);
    const newFood = randInt(1, 4);

    setResources((r) => ({
      wood: r.wood + newWood,
      stone: r.stone + newStone,
      food: r.food + newFood,
    }));

    setFocusTokens((t) => t + 1);

    Alert.alert(
      "✅ Session Complete!",
      `You earned:\n🪵 ${newWood} wood\n🪨 ${newStone} stone\n🍖 ${newFood} food\n🎟️ +1 Focus Token`
    );
  };

  // ---------- FORTRESS COSTS & BUILD ----------
  const costs = useMemo(
    () => ({
      wall: (nextLevel) => ({ wood: 20 * nextLevel, stone: 10 * nextLevel }),
      tower: (nextLevel) => ({ wood: 15 * nextLevel, stone: 20 * nextLevel }),
      hatchery: (nextLevel) => ({ wood: 10 * nextLevel, food: 15 * nextLevel }),
    }),
    []
  );

  const canAfford = (price) =>
    Object.entries(price).every(([k, v]) => resources[k] >= v);

  const spend = (price) =>
    setResources((r) => {
      const nr = { ...r };
      Object.entries(price).forEach(([k, v]) => (nr[k] -= v));
      return nr;
    });

  const addPower = (amt) =>
    setFortress((f) => ({ ...f, power: f.power + amt }));

  const buildStructure = (kind) => {
    setFortress((f) => {
      const levelKey = `${kind}Level`;
      const nextLevel = f[levelKey] + 1;
      const price =
        kind === "wall"
          ? costs.wall(nextLevel)
          : kind === "tower"
          ? costs.tower(nextLevel)
          : costs.hatchery(nextLevel);

      if (!canAfford(price)) {
        Alert.alert("Not enough resources", "Finish a focus session to earn more!");
        return f;
      }

      spend(price);
      const nf = { ...f, [levelKey]: nextLevel };

      const powerGain =
        kind === "wall" ? 5 * nextLevel : kind === "tower" ? 8 * nextLevel : 6 * nextLevel;
      setTimeout(() => addPower(powerGain), 0);

      Alert.alert(
        "🏗️ Built!",
        `${capitalize(kind)} upgraded to Lv.${nextLevel}\nPower +${powerGain}`
      );
      return nf;
    });
  };

  // ---------- TAMING ----------
  const findCreature = () => {
    const base = SPECIES[randInt(0, SPECIES.length - 1)];
    const id = `${base.name}-${Date.now()}-${Math.floor(Math.random() * 999)}`;

    const difficulty = randInt(1, 3); // 1 easy, 2 medium, 3 hard
    const tamingTarget = 100 + (difficulty - 1) * 40; // 100/140/180
    const hostility = difficulty;

    setWild((w) => [
      {
        id,
        name: base.name,
        emoji: base.emoji,
        temperament: base.temperament,
        difficulty,
        taming: 0,
        target: tamingTarget,
        hostility,
        walked: 0,
        level: randInt(1, 3),
      },
      ...w,
    ]);
  };

  const feedCreature = (id) => {
    if (resources.food <= 0) {
      Alert.alert("No food", "Complete sessions or habits to earn 🍖.");
      return;
    }
    const amount = Math.min(resources.food, 2);
    setResources((r) => ({ ...r, food: r.food - amount }));
    setWild((list) =>
      list.map((c) =>
        c.id === id
          ? {
              ...c,
              taming: Math.min(
                c.taming + amount * (c.difficulty === 3 ? 6 : c.difficulty === 2 ? 8 : 10),
                c.target
              ),
            }
          : c
      )
    );
  };

  const calmCreature = (id) => {
    if (focusTokens <= 0) {
      Alert.alert("No Focus Tokens", "Finish a Pomodoro to earn one.");
      return;
    }
    setFocusTokens((t) => t - 1);
    setWild((list) =>
      list.map((c) =>
        c.id === id
          ? {
              ...c,
              hostility: Math.max(0, c.hostility - 1),
              taming: Math.min(c.taming + 12 + (3 - c.hostility) * 2, c.target),
            }
          : c
      )
    );
  };

  const walkCreature = (id) => {
    setWild((list) =>
      list.map((c) =>
        c.id === id
          ? {
              ...c,
              walked: c.walked + 200, // placeholder steps
              taming: Math.min(c.taming + 6, c.target),
            }
          : c
      )
    );
  };

  // Move newly tamed creatures to stable and boost power
  useEffect(() => {
    if (wild.length === 0) return;
    const newlyTamed = wild.filter((c) => c.taming >= c.target);
    if (newlyTamed.length > 0) {
      newlyTamed.forEach((c) => {
        setStable((s) => [...s, { ...c, tamed: true, tamedAt: Date.now(), xp: 0 }]);
        const powerGain = 10 + c.level * 5;
        addPower(powerGain);
        Alert.alert(
          "🦖 Tamed!",
          `${c.emoji} ${c.name} (Lv.${c.level}) joined your fortress!\nPower +${powerGain}`
        );
      });
      setWild((list) => list.filter((c) => c.taming < c.target));
    }
  }, [wild]);

  // ---------- DEFENDER EFFECTS ----------
  function computeDefenderEffects(myPowerRaw, enemyPowerRaw) {
    // Count and level sums
    let raptorLevels = 0;
    let trikeCount = 0;
    let pteraCount = 0;
    let ankyLevels = 0;
    let spinoLevels = 0;

    stable.forEach((c) => {
      if (!c.tamed) return;
      if (c.name === "Raptor") raptorLevels += c.level || 1;
      else if (c.name === "Triceratops") trikeCount += 1;
      else if (c.name === "Pteranodon") pteraCount += 1;
      else if (c.name === "Ankylosaurus") ankyLevels += c.level || 1;
      else if (c.name === "Spinosaurus") spinoLevels += c.level || 1;
    });

    // Perks
    const ambushPct = Math.min(0.30, 0.03 * raptorLevels); // +% to my power
    const scoutPct = Math.min(0.25, 0.05 * pteraCount);    // -% to enemy power
    const bulwarkFlat = 2 * ankyLevels;                    // +flat to my power
    const shieldLossReduce = Math.min(0.60, 0.20 * trikeCount); // -% to losses
    const rendExtraFood = spinoLevels;                     // +🍖 on victory

    const myEff = Math.floor((myPowerRaw + bulwarkFlat) * (1 + ambushPct));
    const enemyEff = Math.floor(enemyPowerRaw * (1 - scoutPct));

    return {
      myEff,
      enemyEff,
      shieldLossReduce,
      rendExtraFood,
      notes: {
        ambushPct, scoutPct, bulwarkFlat, shieldLossReduce, rendExtraFood,
        counts: { raptorLevels, trikeCount, pteraCount, ankyLevels, spinoLevels },
      },
    };
  }

  // ---------- RAIDS ----------
  const canRunDailyRaid = todayStr() !== lastRaidDay;

  // Enemy power scales to your raw power ± variance
  const rollEnemyPower = () => {
    const base = Math.max(10, Math.floor(fortress.power * 0.9)); // 90% min
    const swing = Math.max(10, Math.floor(fortress.power * 0.3)); // ±30%
    return Math.max(10, base + randInt(-swing, swing));
  };

  // Outcome applies resource loss/loot; returns summary text
  const resolveRaid = (isDaily) => {
    const enemyPowerRaw = rollEnemyPower();
    const myPowerRaw = Math.max(0, fortress.power);

    // Apply defender effects
    const effects = computeDefenderEffects(myPowerRaw, enemyPowerRaw);
    const myPowerEff = effects.myEff;
    const enemyPowerEff = effects.enemyEff;

    let result = "victory";
    let delta = { wood: 0, stone: 0, food: 0 };
    let loot = { wood: 0, stone: 0, food: 0 };

    if (myPowerEff >= enemyPowerEff) {
      // Victory: small loot + Spino bonus
      loot = {
        wood: randInt(3, 7),
        stone: randInt(2, 5),
        food: randInt(1, 3) + effects.rendExtraFood,
      };
      setResources((r) => ({
        wood: r.wood + loot.wood,
        stone: r.stone + loot.stone,
        food: r.food + loot.food,
      }));
      result = "victory";
    } else {
      // Defeat: losses reduced by Trike shields
      const gap = enemyPowerEff - myPowerEff;
      const baseFactor = Math.min(0.3, gap / Math.max(20, enemyPowerEff)); // cap 30%
      const reducedFactor = Math.max(0, baseFactor * (1 - effects.shieldLossReduce));

      const loseWood = Math.min(
        resources.wood,
        Math.floor(resources.wood * reducedFactor) + randInt(0, 3)
      );
      const loseStone = Math.min(
        resources.stone,
        Math.floor(resources.stone * reducedFactor) + randInt(0, 2)
      );
      const loseFood = Math.min(
        resources.food,
        Math.floor(resources.food * reducedFactor) + randInt(0, 2)
      );
      delta = { wood: -loseWood, stone: -loseStone, food: -loseFood };
      setResources((r) => ({
        wood: r.wood + delta.wood,
        stone: r.stone + delta.stone,
        food: r.food + delta.food,
      }));
      result = "breached";
    }

    const entry = {
      day: todayStr(),
      enemyPower: enemyPowerRaw,
      myPowerRaw,
      myPowerEff,
      enemyPowerEff,
      result,
      delta,
      loot,
      daily: isDaily,
      ts: Date.now(),
      notes: effects.notes,
    };
    setRaidLog((log) => [entry, ...log].slice(0, 50));

    if (isDaily) setLastRaidDay(todayStr());

    const lootText =
      result === "victory"
        ? `Loot: +${loot.wood}🪵 +${loot.stone}🪨 +${loot.food}🍖`
        : `Losses: ${delta.wood}🪵 ${delta.stone}🪨 ${delta.food}🍖`;

    const notesLines = [];
    if (effects.notes.ambushPct > 0)
      notesLines.push(`Raptor Ambush: +${Math.round(effects.notes.ambushPct * 100)}% power`);
    if (effects.notes.bulwarkFlat > 0)
      notesLines.push(`Anky Bulwark: +${effects.notes.bulwarkFlat} flat power`);
    if (effects.notes.scoutPct > 0)
      notesLines.push(`Pteranodon Scout: -${Math.round(effects.notes.scoutPct * 100)}% enemy`);
    if (effects.notes.shieldLossReduce > 0)
      notesLines.push(`Trike Shield: -${Math.round(effects.notes.shieldLossReduce * 100)}% losses`);
    if (effects.notes.rendExtraFood > 0)
      notesLines.push(`Spino Rend: +${effects.notes.rendExtraFood} 🍖 on victory`);

    Alert.alert(
      result === "victory" ? "🛡️ Raid Repelled!" : "💥 Breach!",
      `Enemy ${enemyPowerEff} vs. Fortress ${myPowerEff}\n${lootText}\n\nDefender perks:\n${notesLines.join(
        "\n"
      ) || "None"}`
    );
  };

  // ---------- UI BITS ----------
  const ResourceBar = () => (
    <View style={styles.resourceBar}>
      <Text style={styles.resourceText}>🪵 {resources.wood}</Text>
      <Text style={styles.resourceText}>🪨 {resources.stone}</Text>
      <Text style={styles.resourceText}>🍖 {resources.food}</Text>
      <Text style={styles.resourceText}>🎟️ {focusTokens}</Text>
    </View>
  );

  const TabBar = () => (
    <View style={styles.tabBar}>
      <TabBtn label="Timer" active={tab === "TIMER"} onPress={() => setTab("TIMER")} />
      <TabBtn label="Fortress" active={tab === "FORTRESS"} onPress={() => setTab("FORTRESS")} />
      <TabBtn label="Creatures" active={tab === "CREATURES"} onPress={() => setTab("CREATURES")} />
      <TabBtn label="Raids" active={tab === "RAIDS"} onPress={() => setTab("RAIDS")} />
    </View>
  );

  const TabBtn = ({ label, active, onPress }) => (
    <TouchableOpacity onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]}>
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  // ---------- SCREENS ----------
  const TimerScreen = () => (
    <View style={styles.screen}>
      <Text style={styles.title}>⏳ Pomodoro</Text>

      <Text style={styles.label}>Set minutes (1–180):</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={customMinutes}
        onChangeText={(t) => setCustomMinutes(t.replace(/[^0-9]/g, ""))}
        editable={!isRunning}
      />

      <Text style={styles.timer}>{formatTime(secondsLeft)}</Text>

      <View style={styles.buttonRow}>
        <Button
          title={isRunning ? "Pause" : "Start"}
          onPress={() => {
            if (!isRunning) {
              const mins = clampMinutes(customMinutes);
              setSecondsLeft((prev) => (prev <= 0 ? mins * 60 : prev));
            }
            setIsRunning((v) => !v);
          }}
        />
        <Button
          title="Reset"
          onPress={() => {
            setIsRunning(false);
            const mins = clampMinutes(customMinutes);
            setSecondsLeft(mins * 60);
          }}
        />
      </View>

      <Text style={styles.subtitle}>
        Session rewards: 🪵 +5–9 | 🪨 +2–5 | 🍖 +1–4 | 🎟️ +1 Focus Token
      </Text>
      <ResourceBar />

      <View style={{ marginTop: 24 }}>
        <Text style={styles.hint}>
          Tip: Tame dinos in the Creatures tab — they now defend raids!
        </Text>
      </View>
    </View>
  );

  const FortressRow = ({ name, level, nextCost, onBuild, emoji }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {emoji} {name} — Lv.{level}
      </Text>
      <Text style={styles.costText}>
        Cost →{" "}
        {Object.entries(nextCost)
          .map(([k, v]) => `${symbolFor(k)} ${v}`)
          .join("  ")}
      </Text>
      <Button title={`Build ${name}`} onPress={onBuild} disabled={!canAfford(nextCost)} />
      {!canAfford(nextCost) && <Text style={styles.needMore}>Need more resources — focus to earn!</Text>}
    </View>
  );

  const FortressScreen = () => {
    const nextWallCost = costs.wall(fortress.wallLevel + 1);
    const nextTowerCost = costs.tower(fortress.towerLevel + 1);
    const nextHatcheryCost = costs.hatchery(fortress.hatcheryLevel + 1);

    return (
      <View style={styles.screen}>
        <Text style={styles.title}>🛡️ Fortress Builder</Text>
        <Text style={styles.power}>Fortress Power: {fortress.power}</Text>
        <ResourceBar />

        <FortressRow name="Walls" emoji="🧱" level={fortress.wallLevel} nextCost={nextWallCost} onBuild={() => buildStructure("wall")} />
        <FortressRow name="Watchtower" emoji="🏹" level={fortress.towerLevel} nextCost={nextTowerCost} onBuild={() => buildStructure("tower")} />
        <FortressRow name="Hatchery" emoji="🥚" level={fortress.hatcheryLevel} nextCost={nextHatcheryCost} onBuild={() => buildStructure("hatchery")} />

        <View style={{ marginTop: 20 }}>
          <Text style={styles.hint}>
            Tame creatures to unlock strong defender bonuses automatically in raids.
          </Text>
        </View>
      </View>
    );
  };

  const CreatureCard = ({ c }) => {
    const pct = Math.round((c.taming / c.target) * 100);
    const bar = "█".repeat(Math.max(0, Math.min(10, Math.round(pct / 10))));
    const empty = "░".repeat(10 - bar.length);

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {c.emoji} {c.name} (Lv.{c.level}) — {c.temperament}
        </Text>
        <Text style={styles.costText}>
          Taming: {pct}% [{bar}
          {empty}] • Target: {c.target}
        </Text>
        <Text style={styles.costText}>Hostility: {c.hostility} • Walked: {c.walked} steps</Text>

        <View style={styles.rowBtns}>
          <Button title="🍖 Feed" onPress={() => feedCreature(c.id)} />
          <Button title="🎟️ Calm" onPress={() => calmCreature(c.id)} />
          <Button title="🚶 Walk" onPress={() => walkCreature(c.id)} />
        </View>
      </View>
    );
  };

  const CreaturesScreen = () => (
    <View style={styles.screen}>
      <Text style={styles.title}>🦖 Creatures</Text>
      <ResourceBar />

      <View style={styles.rowBtns}>
        <Button title="🔍 Find Creature" onPress={findCreature} />
        <Button
          title="Stable Info"
          onPress={() =>
            Alert.alert(
              "Stable",
              `You have ${stable.length} tamed creatures.\nTheir species grant raid perks automatically.`
            )
          }
        />
      </View>

      {wild.length === 0 ? (
        <Text style={[styles.hint, { marginTop: 12 }]}>
          No wild creatures yet. Tap "Find Creature" to encounter one!
        </Text>
      ) : (
        <FlatList style={{ width: "100%" }} data={wild} keyExtractor={(item) => item.id} renderItem={({ item }) => <CreatureCard c={item} />} />
      )}

      {stable.length > 0 && (
        <View style={[styles.card, { marginBottom: 24 }]}>
          <Text style={styles.cardTitle}>🏰 Stable ({stable.length})</Text>
          <Text style={styles.costText}>
            {stable.map((s) => `${s.emoji} ${s.name} Lv.${s.level}`).join("  •  ")}
          </Text>
          <Text style={[styles.costText, { marginTop: 6 }]}>
            Perks: Raptor +3% power/level (cap +30%), Trike −20% losses each (cap −60%), Pteranodon −5% enemy each (cap −25%), Anky +2 power/level, Spino +1🍖/level on victory.
          </Text>
        </View>
      )}
    </View>
  );

  const RaidLogItem = ({ e }) => {
    const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
    const deltaText =
      e.result === "victory"
        ? `Loot: +${e.loot.wood}🪵 +${e.loot.stone}🪨 +${e.loot.food}🍖`
        : `Losses: ${sign(e.delta.wood)}🪵 ${sign(e.delta.stone)}🪨 ${sign(e.delta.food)}🍖`;

    const perkBits = [];
    const n = e.notes || {};
    if (n.ambushPct) perkBits.push(`Raptor +${Math.round(n.ambushPct * 100)}%`);
    if (n.bulwarkFlat) perkBits.push(`Anky +${n.bulwarkFlat}`);
    if (n.scoutPct) perkBits.push(`Pteranodon -${Math.round(n.scoutPct * 100)}% enemy`);
    if (n.shieldLossReduce) perkBits.push(`Trike -${Math.round(n.shieldLossReduce * 100)}% losses`);
    if (n.rendExtraFood) perkBits.push(`Spino +${n.rendExtraFood}🍖`);

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {e.daily ? "📅 Daily Raid" : "⚔️ Practice Raid"} — {e.day}
        </Text>
        <Text style={styles.costText}>
          Enemy {e.enemyPowerEff ?? e.enemyPower} vs. Fortress {e.myPowerEff ?? e.myPowerRaw} → {e.result.toUpperCase()}
        </Text>
        <Text style={styles.costText}>{deltaText}</Text>
        {perkBits.length > 0 && (
          <Text style={styles.costText}>Perks: {perkBits.join(" • ")}</Text>
        )}
      </View>
    );
  };

  const RaidsScreen = () => (
    <View style={styles.screen}>
      <Text style={styles.title}>⚔️ Raids</Text>
      <Text style={styles.power}>Fortress Power: {fortress.power}</Text>
      <ResourceBar />

      <View style={styles.rowBtns}>
        <Button
          title={canRunDailyRaid ? "📅 Run Today's Raid" : "✅ Today's Raid Done"}
          onPress={() => canRunDailyRaid && resolveRaid(true)}
          disabled={!canRunDailyRaid}
        />
        <Button title="🧪 Practice Raid" onPress={() => resolveRaid(false)} />
      </View>

      {raidLog.length === 0 ? (
        <Text style={[styles.hint, { marginTop: 12 }]}>
          No raids yet. Run today's raid to test your defenders!
        </Text>
      ) : (
        <FlatList
          style={{ width: "100%", marginTop: 10 }}
          data={raidLog}
          keyExtractor={(item) => String(item.ts)}
          renderItem={({ item }) => <RaidLogItem e={item} />}
        />
      )}

      <View style={{ marginTop: 12 }}>
        <Text style={styles.hint}>
          Defender perks are applied automatically from your tamed creatures.
        </Text>
      </View>
    </View>
  );

  // ---------- RENDER ----------
  return (
    <View style={styles.container}>
      <TabBar />
      {tab === "TIMER" && <TimerScreen />}
      {tab === "FORTRESS" && <FortressScreen />}
      {tab === "CREATURES" && <CreaturesScreen />}
      {tab === "RAIDS" && <RaidsScreen />}
    </View>
  );
}

// -------- STYLES --------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1f2430", paddingTop: 48 },
  screen: { flex: 1, alignItems: "center", paddingHorizontal: 16 },
  title: { fontSize: 26, color: "#e6edf3", marginBottom: 8, fontWeight: "600" },
  subtitle: { color: "#9fb3c8", marginTop: 12 },
  label: { color: "#e6edf3", marginTop: 8, marginBottom: 6 },
  input: {
    width: 100, height: 44, borderColor: "#00adb5", borderWidth: 1, borderRadius: 8,
    color: "#e6edf3", fontSize: 18, textAlign: "center", marginBottom: 12
  },
  timer: { fontSize: 56, color: "#00adb5", marginBottom: 16, fontWeight: "800" },
  buttonRow: { flexDirection: "row", gap: 10 },
  resourceBar: {
    flexDirection: "row", gap: 16, marginTop: 16, backgroundColor: "#2a3140",
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12
  },
  resourceText: { color: "#e6edf3", fontSize: 16 },
  tabBar: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 12 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "#2a3140" },
  tabBtnActive: { backgroundColor: "#00adb5" },
  tabBtnText: { color: "#9fb3c8", fontWeight: "600" },
  tabBtnTextActive: { color: "#0b111a" },
  card: { width: "100%", backgroundColor: "#2a3140", borderRadius: 14, padding: 14, marginTop: 12 },
  cardTitle: { color: "#e6edf3", fontSize: 18, marginBottom: 8, fontWeight: "600" },
  costText: { color: "#cbd6e2", marginBottom: 8 },
  needMore: { color: "#ffb3b3", marginTop: 6 },
  power: { color: "#e6edf3", marginBottom: 8, fontSize: 16 },
  hint: { color: "#9fb3c8", textAlign: "center" },
  rowBtns: { flexDirection: "row", gap: 10, marginTop: 8 },
});
