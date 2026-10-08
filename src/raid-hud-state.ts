/** Original Currency 138011 points Money_txt to TMP117717 and Dia_txt to
 * TMP119568. Currency.OnValueChanged subscribes Money/Dia, not StarGem.
 * H5 uses the existing wallet formatter; Unity ToString parity is NOT_RUN. */
import type {Session} from './session';
import {walletValue} from './rules';
export function sourceRaidHUDCurrency(session:Session):{money:string;diamonds:string}{
 return {money:walletValue(session.fieldBattle??session.battle).format(),diamonds:String(session.diamonds)};
}
