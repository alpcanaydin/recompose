import { oneAtATime } from './one-at-a-time';

/**
 * Runs work on the gateways directory one turn at a time, in the order it arrived.
 *
 * @summary Reach for it around every read that decides a write to a gateway document. Three
 * channels write those documents — the create, the rewrite, and the move — and each lists the
 * directory before deciding what to put back. Two of them interleaved each decide against a listing
 * the other has already moved past, so one write lands on top of the other while both callers read
 * success: a definition disappears, or a port the engine has already moved to reverts on disk and
 * the next boot binds a port something else holds. One lane across all three makes the second turn
 * read what the first wrote. It stands here, beside the directory it protects, rather than inside
 * any one handler, because a lane one writer does not share is no lane at all.
 */
export const inGatewayWriteOrder = oneAtATime();
