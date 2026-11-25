import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';
import type { HexColor } from 'react-native-android-widget';
import { palettes } from '@/theme/tokens';
import { urgentRows, type WidgetSnapshot } from './snapshot';

/** Noms des widgets déclarés dans app.config.ts (plugin react-native-android-widget). */
export const URGENT_WIDGET = 'AConsommerVite';
export const SHOPPING_WIDGET = 'ListeDeCourses';

type Mode = 'light' | 'dark';
const hex = (c: string) => c as HexColor;

function Frame({ mode, title, subtitle, uri, children }: { mode: Mode; title: string; subtitle: string; uri: string; children: React.ReactNode }) {
  const c = palettes[mode];
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: hex(c.surface), borderRadius: 22, padding: 14, flexDirection: 'column' }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginBottom: 8 }}>
        <TextWidget text={title} style={{ fontSize: 16, fontWeight: 'bold', color: hex(c.text) }} />
        <FlexWidget style={{ flex: 1 }} />
        <TextWidget text={subtitle} style={{ fontSize: 13, color: hex(c.primaryText) }} />
      </FlexWidget>
      {children}
    </FlexWidget>
  );
}

function Empty({ mode, text }: { mode: Mode; text: string }) {
  return <TextWidget text={text} style={{ fontSize: 14, color: hex(palettes[mode].textSecondary) }} />;
}

function Row({ mode, name, detail, detailColor, uri }: { mode: Mode; name: string; detail: string | null; detailColor?: string; uri: string }) {
  const c = palettes[mode];
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: hex(c.border) }}
    >
      <FlexWidget style={{ flex: 1 }}>
        <TextWidget text={name} maxLines={1} truncate="END" style={{ fontSize: 14, color: hex(c.text) }} />
      </FlexWidget>
      {detail ? <TextWidget text={detail} style={{ fontSize: 13, fontWeight: '600', color: hex(detailColor ?? c.textSecondary), marginLeft: 8 }} /> : null}
    </FlexWidget>
  );
}

function urgentColor(mode: Mode, state: string): string {
  const c = palettes[mode];
  if (state === 'perime') return c.danger;
  if (state === 'urgent') return c.urgent;
  return c.textSecondary;
}

function Urgent({ snapshot, mode, today }: { snapshot: WidgetSnapshot; mode: Mode; today: Date }) {
  const rows = urgentRows(snapshot, today);
  const uri = 'gaspalli://inventaire';
  return (
    <Frame mode={mode} title="À consommer vite" subtitle={rows.length ? String(rows.length) : ''} uri={uri}>
      {rows.length === 0 ? (
        <Empty mode={mode} text="Rien d’urgent. Bravo !" />
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {rows.map((r, i) => (
            <Row key={i} mode={mode} name={r.name} detail={r.label} detailColor={urgentColor(mode, r.state)} uri={uri} />
          ))}
        </ListWidget>
      )}
    </Frame>
  );
}

function Shopping({ snapshot, mode }: { snapshot: WidgetSnapshot; mode: Mode }) {
  const uri = 'gaspalli://courses';
  const more = snapshot.shoppingTotal - snapshot.shopping.length;
  return (
    <Frame mode={mode} title="Courses" subtitle={snapshot.shoppingTotal ? `${snapshot.shoppingTotal} à acheter` : ''} uri={uri}>
      {snapshot.shopping.length === 0 ? (
        <Empty mode={mode} text="La liste est vide." />
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {snapshot.shopping.map((s, i) => (
            <Row key={i} mode={mode} name={s.name} detail={s.detail} uri={uri} />
          ))}
          {more > 0 ? <Row mode={mode} name={`Et ${more} autre${more > 1 ? 's' : ''}…`} detail={null} uri={uri} /> : null}
        </ListWidget>
      )}
    </Frame>
  );
}

/** Rendu d'un widget (clair + sombre : le lanceur choisit selon le thème du téléphone). */
export function renderGaspalliWidget(name: string, snapshot: WidgetSnapshot, today: Date = new Date()) {
  if (name === SHOPPING_WIDGET) return { light: <Shopping snapshot={snapshot} mode="light" />, dark: <Shopping snapshot={snapshot} mode="dark" /> };
  return { light: <Urgent snapshot={snapshot} mode="light" today={today} />, dark: <Urgent snapshot={snapshot} mode="dark" today={today} /> };
}
