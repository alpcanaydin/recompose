# api-keys Specification

## MODIFIED Requirements

### Requirement: A row reports the product, the name, and the tail

A row MUST read as two lines: the product title its catalog entry carried, then the name beside the masked key tail, and nothing more. The mask MUST hold the last four characters of the trimmed key and MUST carry no vendor prefix. A trim of eight or fewer characters MUST mint no tail, so a mask never holds the whole secret, and the row reads the name beside the bare bullets. The main process MUST compute the mask at connect time and store it on the row as a non-secret field, so listing accounts never opens the vault.

#### Scenario: a connected key reads as two lines

- When the surface lists a connected key account
- Then the first line reads the product title
- And the second line reads the name beside the masked tail

#### Scenario: the mask reveals four characters and no prefix

- Given a stored key
- When its row shows the mask
- Then the mask holds the last four characters of the trimmed key
- And no vendor prefix stands in front of them

#### Scenario: listing accounts leaves the vault closed

- Given connected key accounts
- When the surface lists them
- Then every row reads from the account registry alone
- And no vault read happens
