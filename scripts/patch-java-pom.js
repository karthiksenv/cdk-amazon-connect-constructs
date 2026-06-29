const fs = require('fs');
const path = require('path');

const pomPath = path.join(__dirname, '..', 'dist', 'java', 'pom.xml');
const legacyPatterns = [
  /nexus-staging-maven-plugin/,
  /oss\.sonatype\.org/,
  /s01\.oss\.sonatype\.org/,
  /<distributionManagement>/,
];

const centralPlugin = `      <plugin>
        <groupId>org.sonatype.central</groupId>
        <artifactId>central-publishing-maven-plugin</artifactId>
        <version>0.9.0</version>
        <extensions>true</extensions>
        <configuration>
          <publishingServerId>central</publishingServerId>
        </configuration>
      </plugin>`;

if (!fs.existsSync(pomPath)) {
  throw new Error(`Generated Java pom.xml was not found at ${pomPath}. Run jsii-pacmak for the Java target first.`);
}

const pom = fs.readFileSync(pomPath, 'utf8');

for (const pattern of legacyPatterns) {
  if (pattern.test(pom)) {
    throw new Error(`Generated Java pom.xml contains legacy OSSRH publishing config matching ${pattern}.`);
  }
}

if (pom.includes('central-publishing-maven-plugin')) {
  process.stdout.write('Generated Java pom.xml already contains central-publishing-maven-plugin.\n');
  process.exit(0);
}

if (!pom.includes('  </plugins>')) {
  throw new Error('Generated Java pom.xml does not contain a build plugins section to patch.');
}

const patched = pom.replace('    </plugins>', `${centralPlugin}\n    </plugins>`);
fs.writeFileSync(pomPath, patched);
process.stdout.write('Added central-publishing-maven-plugin to generated Java pom.xml.\n');
