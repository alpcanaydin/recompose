# local-runtimes Specification

## ADDED Requirements

### Requirement: Detection comes before adding a local runtime

The Local Runtimes catalog MUST offer Ollama as its one connectable entry. The entries that lack a contract MUST stand inert under a Soon badge rather than hidden: LM Studio, llama.cpp, vLLM, and a Custom local server escape hatch. Picking Ollama MUST look for the runtime at its documented localhost port and say what it found before recompose stores anything. Adding the account MUST store the address it answers at and MUST NOT ask for a credential.

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

### Requirement: A row reads the runtime's standing as an observation

A local runtime row MUST read the runtime's name over its stored address, and MUST report whether it answers as of the reading. The registry MUST NOT store the standing, so no row carries a stale claim about a server that stopped after the last look.

#### Scenario: a stored runtime stops answering

- Given a stored Ollama account whose server has stopped
- When the surface lists it
- Then the row reads unreachable as of the reading
- And the stored account keeps its address unchanged
