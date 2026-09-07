import type React from 'react'
import type { GamePluginProfileCard, ProfileCardProps } from '../plugin-types'
import { PenguinShowcaseAvatar } from './components/penguin-showcase-avatar'
import { BELT_PROGRESSION, type BeltInfo } from '../../../shared/progression'

export const cardJitsuProfileCard: GamePluginProfileCard = {
  renderCover: ({ stat }: ProfileCardProps): React.ReactNode => {
    const rank = stat?.ninja?.rank ?? 0
    const colorId = stat?.ninja?.colorId ?? 1
    return <PenguinShowcaseAvatar colorId={colorId} beltRank={rank} />
  },

  getMetrics: ({ stat }: ProfileCardProps) => {
    const rank = stat?.ninja?.rank ?? 0
    const cardsCount = stat?.ninja?.cardsCount ?? 0
    const beltName =
      rank >= 10
        ? 'Ninja Master'
        : BELT_PROGRESSION.find((b: BeltInfo) => b.rank === rank)?.name ?? 'White Belt'

    return [
      { label: 'Martial Belt', value: beltName },
      { label: 'Card Binder', value: `${cardsCount} / 509` },
    ]
  },

  runsLabel: 'Duels Won',

  actionLabel: {
    owner: 'Enter Dojo',
    other: 'Challenge in Dojo',
  },
}
