#!/usr/bin/env python3


def main():
    print("This module is broken")


try:
    from ansible.module_utils.basic import *  # noqa
except ImportError:
    pass


if __name__ == '__main__':
    main()
