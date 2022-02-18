import { Match } from "../../entity/Match";

export default class MatchInfo {
  id: string;
  shopName: string;
  section: string;
  total: number;
  priceAtLeast: number;
  purchaserName: string;
  createdAt: number;

  static from(match: Match): MatchInfo {
    const res = new MatchInfo();
    res.id = match.id;
    res.shopName = match.shopName;
    res.section = match.section;
    res.total = match.totalPrice;
    res.priceAtLeast = match.atLeastPrice;
    res.purchaserName = match.purchaserName;
    res.createdAt = match.createdAt;
    return res;
  }
}
