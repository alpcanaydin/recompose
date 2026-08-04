# local-runtimes Specification

## Purpose

The behavioral contract of a local runtime account in recompose. A local runtime is a server this machine already runs. The account holds an address and no credential, and everything recompose claims about it stands as an observation as of the reading. This contract states what the catalog offers, how detection precedes adding, what the person's one knob is, what a stored row reads, and what the registry never keeps.

## Requirements

### Requirement: Detection comes before adding a local runtime

The Local Runtimes catalog MUST offer Ollama as its one connectable entry. The entries that lack a contract MUST stand inert under a Soon badge rather than hidden: LM Studio, llama.cpp, vLLM, and a Custom local server escape hatch. Picking Ollama MUST look for the runtime at its documented port and say what it found before recompose stores anything. The look MUST ask the runtime's version endpoint and MUST report the runtime as running only on a successful answer carrying a version. Any other answer on the port MUST report as another server, so a collision never reads as the runtime. The person MAY point the look at another port, because the runtime's own host variable moves it, and the host MUST stay the loopback address recompose mints. A runtime bound off the loopback host therefore reads as not running, and recompose MUST NOT store a non-loopback address. Adding the account MUST store the address it answers at and MUST NOT ask for a credential.

#### Scenario: a running runtime answers and joins the registry

- Given Ollama answers on its documented localhost port
- When a person picks Ollama in the catalog the Local Runtimes surface opened
- Then the surface says the runtime answered at its address
- And adding it stores an account with no credential

#### Scenario: a runtime that isn't running says so

- Given nothing answers on the documented port
- When a person picks Ollama in the catalog
- Then the surface says the runtime didn't answer
- And recompose stores nothing until the person decides

#### Scenario: a runtime on a moved port answers through the port field

- Given Ollama answers on a port that isn't the documented one
- When a person picks Ollama and points the look at that port
- Then the surface says the runtime answered at the loopback host and that port
- And adding it stores that address with no credential

#### Scenario: another server on the port never reads as the runtime

- Given a server that isn't Ollama answers on the documented port
- When a person picks Ollama in the catalog
- Then the surface says another server answered there
- And the surface never claims the runtime is running

### Requirement: A row reads the runtime's standing as an observation

A local runtime row MUST read the runtime's name over its stored address, and MUST report whether it answers as of the reading. The registry MUST NOT store the standing, so no row carries a stale claim about a server that stopped after the last look.

#### Scenario: a stored runtime stops answering

- Given a stored Ollama account whose server has stopped
- When the surface lists it
- Then the row reads not running as of the reading
- And the stored account keeps its address unchanged
