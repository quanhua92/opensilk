import argparse
import asyncio
import logging

from worker import start


def setup_logging(verbose: bool = False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def cli():
    parser = argparse.ArgumentParser(description="OpenSilk Task Worker")
    parser.add_argument("--worker-id", default="worker-1", help="Worker identifier")
    parser.add_argument("--no-redis", action="store_true", help="Disable Redis Stream, use polling only")
    parser.add_argument("--verbose", "-v", action="store_true", help="Debug logging")
    args = parser.parse_args()

    setup_logging(args.verbose)
    logger = logging.getLogger(__name__)
    logger.info("Starting OpenSilk worker (%s)", args.worker_id)

    try:
        asyncio.run(start(args.worker_id, use_redis=not args.no_redis))
    except KeyboardInterrupt:
        logger.info("Worker stopped by user")


if __name__ == "__main__":
    cli()
